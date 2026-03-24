import Foundation

/// Mock data for development and testing.
/// When the Flow API is available, the app will use real data.
/// These mocks simulate the typical Flow Argentina channel lineup and VOD catalog.
enum MockData {

    // MARK: - User

    static let user = FlowUser(
        id: "user-001",
        email: "usuario@personal.com.ar",
        displayName: "Usuario Flow",
        avatarURL: nil,
        plan: FlowPlan(name: "Flow Premium", tier: .premium, hasHD: true, has4K: true, maxDevices: 5),
        maxStreams: 3,
        activeStreams: 0
    )

    static let authToken = AuthToken(
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        expiresAt: Date().addingTimeInterval(86400)
    )

    // MARK: - Channels (typical Flow Argentina lineup)

    // Apple's public HLS test streams for demo mode
    private static let testStream1 = "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_adv_example_hevc/master.m3u8"
    private static let testStream2 = "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8"

    static let channels: [Channel] = [
        Channel(id: "ch-eltrece", number: 13, name: "eltrece", logoURL: nil, category: .entretenimiento, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Pasapalabra", "Entretenimiento"), nextProgram: nil),
        Channel(id: "ch-telefe", number: 11, name: "Telefe", logoURL: nil, category: .entretenimiento, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Gran Hermano", "Reality"), nextProgram: nil),
        Channel(id: "ch-america", number: 2, name: "América TV", logoURL: nil, category: .entretenimiento, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Intrusos", "Espectáculos"), nextProgram: nil),
        Channel(id: "ch-tvpublica", number: 7, name: "TV Pública", logoURL: nil, category: .entretenimiento, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Cocineros Argentinos", "Cocina"), nextProgram: nil),
        Channel(id: "ch-canal9", number: 9, name: "Canal 9", logoURL: nil, category: .entretenimiento, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Bendita", "Entretenimiento"), nextProgram: nil),
        Channel(id: "ch-net", number: 10, name: "NET TV", logoURL: nil, category: .entretenimiento, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("El Noticiero", "Noticias"), nextProgram: nil),
        Channel(id: "ch-tn", number: 26, name: "TN - Todo Noticias", logoURL: nil, category: .noticias, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("TN Central", "Noticias"), nextProgram: nil),
        Channel(id: "ch-c5n", number: 27, name: "C5N", logoURL: nil, category: .noticias, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Argenzuela", "Noticias"), nextProgram: nil),
        Channel(id: "ch-cronica", number: 28, name: "Crónica TV", logoURL: nil, category: .noticias, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Crónica Noticias", "Noticias"), nextProgram: nil),
        Channel(id: "ch-lanacion", number: 29, name: "LN+", logoURL: nil, category: .noticias, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Odisea Argentina", "Noticias"), nextProgram: nil),
        Channel(id: "ch-espn", number: 100, name: "ESPN", logoURL: nil, category: .deportes, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("SportsCenter", "Deportes"), nextProgram: nil),
        Channel(id: "ch-espn2", number: 101, name: "ESPN 2", logoURL: nil, category: .deportes, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("NBA en vivo", "Deportes"), nextProgram: nil),
        Channel(id: "ch-espn3", number: 102, name: "ESPN 3", logoURL: nil, category: .deportes, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Fútbol Argentino", "Deportes"), nextProgram: nil),
        Channel(id: "ch-fox", number: 103, name: "FOX Sports", logoURL: nil, category: .deportes, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Copa Libertadores", "Deportes"), nextProgram: nil),
        Channel(id: "ch-tyc", number: 104, name: "TyC Sports", logoURL: nil, category: .deportes, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Fútbol de Primera", "Deportes"), nextProgram: nil),
        Channel(id: "ch-dsports", number: 105, name: "DSports", logoURL: nil, category: .deportes, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("UEFA Champions League", "Deportes"), nextProgram: nil),
        Channel(id: "ch-hbo", number: 200, name: "HBO", logoURL: nil, category: .peliculas, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("The Last of Us", "Drama"), nextProgram: nil),
        Channel(id: "ch-hbo2", number: 201, name: "HBO 2", logoURL: nil, category: .peliculas, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Succession", "Drama"), nextProgram: nil),
        Channel(id: "ch-star", number: 210, name: "Star Channel", logoURL: nil, category: .peliculas, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Alien", "Ciencia Ficción"), nextProgram: nil),
        Channel(id: "ch-tnt", number: 215, name: "TNT", logoURL: nil, category: .peliculas, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Batman Begins", "Acción"), nextProgram: nil),
        Channel(id: "ch-space", number: 216, name: "SPACE", logoURL: nil, category: .peliculas, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("John Wick", "Acción"), nextProgram: nil),
        Channel(id: "ch-axn", number: 220, name: "AXN", logoURL: nil, category: .series, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("CSI", "Policial"), nextProgram: nil),
        Channel(id: "ch-warner", number: 221, name: "Warner Channel", logoURL: nil, category: .series, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("The Big Bang Theory", "Comedia"), nextProgram: nil),
        Channel(id: "ch-fx", number: 222, name: "FX", logoURL: nil, category: .series, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("American Horror Story", "Terror"), nextProgram: nil),
        Channel(id: "ch-paramount", number: 225, name: "Paramount Network", logoURL: nil, category: .series, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Yellowstone", "Drama"), nextProgram: nil),
        Channel(id: "ch-disney", number: 300, name: "Disney Channel", logoURL: nil, category: .infantil, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Bluey", "Infantil"), nextProgram: nil),
        Channel(id: "ch-nick", number: 301, name: "Nickelodeon", logoURL: nil, category: .infantil, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Bob Esponja", "Infantil"), nextProgram: nil),
        Channel(id: "ch-cn", number: 302, name: "Cartoon Network", logoURL: nil, category: .infantil, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Hora de Aventura", "Infantil"), nextProgram: nil),
        Channel(id: "ch-natgeo", number: 400, name: "National Geographic", logoURL: nil, category: .documentales, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("Cosmos", "Documental"), nextProgram: nil),
        Channel(id: "ch-discovery", number: 401, name: "Discovery Channel", logoURL: nil, category: .documentales, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("Mythbusters", "Documental"), nextProgram: nil),
        Channel(id: "ch-history", number: 402, name: "History Channel", logoURL: nil, category: .documentales, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("El Precio de la Historia", "Documental"), nextProgram: nil),
        Channel(id: "ch-mtv", number: 500, name: "MTV", logoURL: nil, category: .musica, isHD: true, streamURL: testStream2, currentProgram: sampleProgram("MTV Hits", "Música"), nextProgram: nil),
        Channel(id: "ch-vh1", number: 501, name: "VH1", logoURL: nil, category: .musica, isHD: true, streamURL: testStream1, currentProgram: sampleProgram("VH1 Classics", "Música"), nextProgram: nil),
    ]

    // MARK: - VOD Content

    static let vodItems: [VODContent] = [
        VODContent(id: "vod-001", title: "Argentina, 1985", originalTitle: nil, description: "La historia del juicio a las juntas militares de la última dictadura argentina, liderado por los fiscales Julio Strassera y Luis Moreno Ocampo.", year: 2022, duration: 140, rating: "ATP +13", genre: ["Drama", "Historia"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .movie, seasons: nil, isFavorite: false),
        VODContent(id: "vod-002", title: "El Secreto de sus Ojos", originalTitle: nil, description: "Un empleado judicial retirado escribe una novela basada en un caso que lo marcó: la violación y asesinato de una joven.", year: 2009, duration: 129, rating: "ATP +16", genre: ["Drama", "Thriller"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .movie, seasons: nil, isFavorite: true),
        VODContent(id: "vod-003", title: "Relatos Salvajes", originalTitle: nil, description: "Seis historias independientes conectadas por la violencia y la venganza en la sociedad argentina moderna.", year: 2014, duration: 122, rating: "ATP +16", genre: ["Comedia", "Drama", "Thriller"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .movie, seasons: nil, isFavorite: false),
        VODContent(id: "vod-004", title: "El Clan", originalTitle: nil, description: "La historia real de la familia Puccio, que secuestraba personas durante la transición democrática argentina.", year: 2015, duration: 110, rating: "ATP +16", genre: ["Drama", "Thriller"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .movie, seasons: nil, isFavorite: false),
        VODContent(id: "vod-005", title: "Nueve Reinas", originalTitle: nil, description: "Dos estafadores se encuentran y planean un gran golpe con unas estampillas falsas.", year: 2000, duration: 114, rating: "ATP +13", genre: ["Comedia", "Drama", "Thriller"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .movie, seasons: nil, isFavorite: true),
        VODContent(id: "vod-006", title: "La Odisea de los Giles", originalTitle: nil, description: "Un grupo de vecinos de un pueblo decide recuperar sus ahorros tras ser estafados durante la crisis de 2001.", year: 2019, duration: 116, rating: "ATP +13", genre: ["Comedia", "Drama"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .movie, seasons: nil, isFavorite: false),
        VODContent(id: "vod-007", title: "El Marginal", originalTitle: nil, description: "Un ex policía se infiltra en una cárcel para rescatar a la hija de un juez, descubriendo un mundo de corrupción y violencia.", year: 2016, duration: nil, rating: "ATP +16", genre: ["Drama", "Acción"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .series, seasons: [
            Season(id: "s1", number: 1, episodes: (1...13).map { ep in
                Episode(id: "s1e\(ep)", number: ep, title: "Episodio \(ep)", description: nil, duration: 45, imageURL: nil, streamURL: nil)
            })
        ], isFavorite: true),
        VODContent(id: "vod-008", title: "El Encargado", originalTitle: nil, description: "Eliseo es el encargado de un edificio en Buenos Aires que manipula a los vecinos para su beneficio.", year: 2022, duration: nil, rating: "ATP +13", genre: ["Comedia", "Drama"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .series, seasons: [
            Season(id: "s1", number: 1, episodes: (1...10).map { ep in
                Episode(id: "s1e\(ep)", number: ep, title: "Episodio \(ep)", description: nil, duration: 30, imageURL: nil, streamURL: nil)
            })
        ], isFavorite: false),
        VODContent(id: "vod-009", title: "Ocupas", originalTitle: nil, description: "Un joven de clase media termina viviendo en una casa okupa, donde descubre una realidad muy diferente.", year: 2000, duration: nil, rating: "ATP +16", genre: ["Drama"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .series, seasons: [
            Season(id: "s1", number: 1, episodes: (1...11).map { ep in
                Episode(id: "s1e\(ep)", number: ep, title: "Episodio \(ep)", description: nil, duration: 50, imageURL: nil, streamURL: nil)
            })
        ], isFavorite: false),
        VODContent(id: "vod-010", title: "Esperando la Carroza", originalTitle: nil, description: "Una familia disfuncional argentina enfrenta el caos cuando desaparece la abuela Mamá Cora.", year: 1985, duration: 87, rating: "ATP", genre: ["Comedia"], posterURL: nil, backdropURL: nil, streamURL: nil, contentType: .movie, seasons: nil, isFavorite: true),
    ]

    // MARK: - VOD Categories

    static let vodCategories: [VODCategory] = [
        VODCategory(id: "cat-trending", name: "Tendencias", items: Array(vodItems.prefix(5))),
        VODCategory(id: "cat-arg", name: "Cine Argentino", items: vodItems.filter { $0.contentType == .movie }),
        VODCategory(id: "cat-series", name: "Series", items: vodItems.filter { $0.contentType == .series }),
        VODCategory(id: "cat-favorites", name: "Mis Favoritos", items: vodItems.filter { $0.isFavorite }),
        VODCategory(id: "cat-drama", name: "Drama", items: vodItems.filter { $0.genre.contains("Drama") }),
        VODCategory(id: "cat-comedia", name: "Comedia", items: vodItems.filter { $0.genre.contains("Comedia") }),
    ]

    // MARK: - Featured Content

    static let featuredContent: [FeaturedContent] = [
        FeaturedContent(id: "f-1", title: "El Marginal - Nueva Temporada", subtitle: "Estreno exclusivo en Flow", imageURL: nil, content: .vod(vodItems[6])),
        FeaturedContent(id: "f-2", title: "Copa Libertadores en Vivo", subtitle: "Mirá todos los partidos en ESPN y FOX Sports", imageURL: nil, content: .channel(channels[13])),
        FeaturedContent(id: "f-3", title: "Argentina, 1985", subtitle: "La película más vista del año", imageURL: nil, content: .vod(vodItems[0])),
        FeaturedContent(id: "f-4", title: "El Encargado", subtitle: "La comedia del momento con Francella", imageURL: nil, content: .vod(vodItems[7])),
    ]

    // MARK: - Continue Watching

    static let continueWatching: [ContinueWatching] = [
        ContinueWatching(id: "cw-1", contentId: "vod-007", title: "El Marginal - T1 E5", imageURL: nil, progress: 0.65, streamURL: nil, lastWatched: Date().addingTimeInterval(-3600)),
        ContinueWatching(id: "cw-2", contentId: "vod-008", title: "El Encargado - T1 E3", imageURL: nil, progress: 0.3, streamURL: nil, lastWatched: Date().addingTimeInterval(-7200)),
        ContinueWatching(id: "cw-3", contentId: "vod-001", title: "Argentina, 1985", imageURL: nil, progress: 0.45, streamURL: nil, lastWatched: Date().addingTimeInterval(-86400)),
    ]

    // MARK: - Helpers

    static func sampleProgram(_ title: String, _ genre: String) -> Program {
        let now = Date()
        let calendar = Calendar.current
        let startOfHour = calendar.date(bySetting: .minute, value: 0, of: now) ?? now
        return Program(
            id: "prog-\(title.lowercased().replacingOccurrences(of: " ", with: "-"))",
            title: title,
            description: "Programa en vivo",
            startTime: startOfHour,
            endTime: startOfHour.addingTimeInterval(3600),
            imageURL: nil,
            rating: "ATP",
            genre: genre
        )
    }

    static func programs(for channelId: String) -> [Program] {
        let calendar = Calendar.current
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)

        return (0..<24).map { hour in
            let start = calendar.date(byAdding: .hour, value: hour, to: startOfDay)!
            let end = calendar.date(byAdding: .hour, value: hour + 1, to: startOfDay)!
            return Program(
                id: "\(channelId)-\(hour)",
                title: "Programa \(hour):00",
                description: "Descripción del programa",
                startTime: start,
                endTime: end,
                imageURL: nil,
                rating: "ATP",
                genre: "General"
            )
        }
    }

    static func searchResults(for query: String) -> SearchResults {
        let matchingChannels = channels.filter {
            $0.name.localizedCaseInsensitiveContains(query)
        }
        let matchingVOD = vodItems.filter {
            $0.title.localizedCaseInsensitiveContains(query) ||
            $0.genre.contains { $0.localizedCaseInsensitiveContains(query) }
        }
        return SearchResults(channels: matchingChannels, vod: matchingVOD)
    }
}
