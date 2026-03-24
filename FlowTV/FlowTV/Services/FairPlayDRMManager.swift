import AVFoundation

/// Handles FairPlay Streaming (FPS) DRM for Flow content on Apple TV.
///
/// FairPlay flow:
///   1. AVPlayer encounters an encrypted key → triggers `contentKeySession`
///   2. We fetch the FairPlay certificate from Flow's server
///   3. We create an SPC (Server Playback Context) request
///   4. We send the SPC to Flow's license server with auth headers
///   5. Flow returns a CKC (Content Key Context)
///   6. AVPlayer uses the CKC to decrypt and play
class FairPlayDRMManager: NSObject, AVContentKeySessionDelegate {

    private let licenseURL: String
    private let drmToken: String?
    private let certificateURL: String?
    private let jwtToken: String
    private var contentKeySession: AVContentKeySession?
    private var cachedCertificate: Data?

    init(licenseURL: String, drmToken: String?, certificateURL: String?, jwtToken: String) {
        self.licenseURL = licenseURL
        self.drmToken = drmToken
        self.certificateURL = certificateURL
        self.jwtToken = jwtToken
        super.init()
    }

    /// Attach FairPlay content key session to an AVURLAsset.
    func configureAsset(_ asset: AVURLAsset) {
        let session = AVContentKeySession(keySystem: .fairPlayStreaming)
        session.setDelegate(self, queue: DispatchQueue(label: "com.flowtv.fairplay"))
        session.addContentKeyRecipient(asset)
        self.contentKeySession = session
    }

    // MARK: - AVContentKeySessionDelegate

    func contentKeySession(
        _ session: AVContentKeySession,
        didProvide keyRequest: AVContentKeyRequest
    ) {
        handleKeyRequest(keyRequest)
    }

    func contentKeySession(
        _ session: AVContentKeySession,
        didProvideRenewingContentKeyRequest keyRequest: AVContentKeyRequest
    ) {
        handleKeyRequest(keyRequest)
    }

    func contentKeySession(
        _ session: AVContentKeySession,
        contentKeyRequest keyRequest: AVContentKeyRequest,
        didFailWithError error: Error
    ) {
        print("[FairPlay] Key request failed: \(error.localizedDescription)")
    }

    // MARK: - Key Request Handling

    private func handleKeyRequest(_ keyRequest: AVContentKeyRequest) {
        guard let contentKeyIdentifier = keyRequest.identifier as? String,
              let contentKeyIdentifierURL = URL(string: contentKeyIdentifier),
              let assetIDString = contentKeyIdentifierURL.host else {
            keyRequest.processContentKeyResponseError(
                StreamError.drmFailed("Invalid content key identifier")
            )
            return
        }

        guard let assetIDData = assetIDString.data(using: .utf8) else {
            keyRequest.processContentKeyResponseError(
                StreamError.drmFailed("Could not encode asset ID")
            )
            return
        }

        Task {
            do {
                // 1. Get FairPlay certificate
                let certificate = try await fetchCertificate()

                // 2. Create SPC
                let spcData = try await keyRequest.makeStreamingContentKeyRequestData(
                    forApp: certificate,
                    contentIdentifier: assetIDData,
                    options: [AVContentKeyRequestProtocolVersionsKey: [1]]
                )

                // 3. Send SPC to license server, get CKC
                let ckcData = try await fetchContentKeyContext(spc: spcData)

                // 4. Provide CKC to player
                let keyResponse = AVContentKeyResponse(fairPlayStreamingKeyResponseData: ckcData)
                keyRequest.processContentKeyResponse(keyResponse)

            } catch {
                keyRequest.processContentKeyResponseError(error)
            }
        }
    }

    // MARK: - Certificate Fetch

    /// Fetches the FairPlay application certificate from Flow's server.
    private func fetchCertificate() async throws -> Data {
        if let cached = cachedCertificate {
            return cached
        }

        // Try the certificate URL from the content source response first,
        // then fall back to the standard Flow FairPlay cert endpoint
        let certURLString = certificateURL
            ?? "\(FlowAPIService.baseURL)/prm/v1/fairplay/certificate"

        guard let url = URL(string: certURLString) else {
            throw StreamError.fairPlayCertificateNotAvailable
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 15
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue(FlowAPIService.baseURL, forHTTPHeaderField: "referer")
        request.setValue(FlowAPIService.baseURL, forHTTPHeaderField: "origin")
        request.setValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode),
              !data.isEmpty else {
            throw StreamError.fairPlayCertificateNotAvailable
        }

        cachedCertificate = data
        return data
    }

    // MARK: - License (CKC) Fetch

    /// Sends the SPC to Flow's license server and receives the CKC.
    private func fetchContentKeyContext(spc: Data) async throws -> Data {
        guard let url = URL(string: licenseURL) else {
            throw StreamError.drmFailed("Invalid license URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        request.setValue("*/*", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue(FlowAPIService.appBaseURL, forHTTPHeaderField: "origin")
        request.setValue(FlowAPIService.appBaseURL, forHTTPHeaderField: "referer")
        request.setValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")

        // DRM token header (required by Flow's license server)
        if let drmToken {
            request.setValue(drmToken, forHTTPHeaderField: "drm-token")
        }

        request.httpBody = spc

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode),
              !data.isEmpty else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw StreamError.drmFailed("License server returned \(code)")
        }

        return data
    }
}
