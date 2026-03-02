"use client";
import { useState } from "react";
import { T, f } from "../lib/tokens";
import { getMenuKey, MENU_TABS_ES, MENU_TABS_EN, MENU_TAB_LABELS, M } from "../lib/menu-data";

export default function MenuOverlay({ onClose }) {
  const defaultKey = getMenuKey();
  const lang = (typeof navigator !== "undefined" ? navigator.language : "es").toLowerCase();
  const en = lang.startsWith("en");
  const tabs = en ? MENU_TABS_EN : MENU_TABS_ES;
  const [active, setActive] = useState(defaultKey);
  const menu = M[active];
  const tagColors = { V:{bg:"#E8F5EE",c:"#2D7A4F"}, "V*":{bg:"#E8F5EE",c:"#2D7A4F"}, P:{bg:"#FFF0E0",c:"#D4842A"}, S:{bg:"#FFF0E0",c:"#D4842A"}, GF:{bg:"#F0ECFF",c:"#7B61C4"} };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)",display:"flex",flexDirection:"column" }} onClick={onClose}>
      <div style={{ margin:"40px 8px 8px",flex:1,borderRadius:"20px",overflow:"hidden",background:T.bg,display:"flex",flexDirection:"column",boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"16px 20px 0",borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px" }}>
            <div style={{ fontSize:"18px",fontWeight:"700",color:T.text,fontFamily:f.sans }}>📖 Menú</div>
            <button onClick={onClose} style={{ width:"32px",height:"32px",borderRadius:"50%",background:T.bgPage,border:"none",cursor:"pointer",fontSize:"16px",color:T.textMed,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
          </div>
          <div style={{ display:"flex",gap:"4px",overflowX:"auto",paddingBottom:"0" }}>
            {tabs.map(k=>(
              <button key={k} onClick={()=>setActive(k)} style={{
                padding:"8px 14px",background:"none",border:"none",cursor:"pointer",
                fontSize:"13px",fontWeight:active===k?"700":"500",fontFamily:f.sans,
                color:active===k?T.accent:T.textLight,whiteSpace:"nowrap",
                borderBottom:active===k?`2.5px solid ${T.accent}`:"2.5px solid transparent",
                marginBottom:"-1px",transition:"all 0.15s",
              }}>{MENU_TAB_LABELS[k]}</button>
            ))}
          </div>
        </div>
        <div style={{ flex:1,overflow:"auto",padding:"16px 20px",WebkitOverflowScrolling:"touch" }}>
          {menu.sections.map((sec,si)=>(
            <div key={si} style={{ marginBottom:"24px" }}>
              <div style={{ fontSize:"18px",fontWeight:"700",color:T.text,fontFamily:f.sans,marginBottom:sec.s?"2px":"12px" }}>{sec.t}</div>
              {sec.s&&<div style={{ fontSize:"12px",color:T.textLight,marginBottom:"12px",textTransform:"uppercase",letterSpacing:"0.5px" }}>{sec.s}</div>}
              {sec.items.map((item,ii)=>(
                <div key={ii} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 0",borderBottom:ii<sec.items.length-1?`1px solid ${T.border}`:"none" }}>
                  <div style={{ flex:1,paddingRight:"12px" }}>
                    <div style={{ fontSize:"15px",color:T.text,lineHeight:1.4 }}>{item.n}</div>
                    {item.g.length>0&&(
                      <div style={{ display:"flex",gap:"4px",marginTop:"4px",flexWrap:"wrap" }}>
                        {item.g.map(tag=>{
                          const tc=tagColors[tag]||{bg:"#f0f0f0",c:T.textMed};
                          return <span key={tag} style={{ fontSize:"11px",fontWeight:"600",padding:"2px 7px",borderRadius:"6px",background:tc.bg,color:tc.c }}>{tag}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:"right",whiteSpace:"nowrap" }}>
                    {item.x&&<span style={{ fontSize:"11px",color:T.textLight,marginRight:"4px" }}>{item.x}</span>}
                    <span style={{ fontSize:"15px",fontWeight:"600",color:T.text }}>${item.p.toLocaleString()}</span>
                    {item.p2&&<span style={{ fontSize:"13px",color:T.textLight }}> / ${item.p2.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div style={{ textAlign:"center",padding:"16px 0 24px",fontSize:"13px",color:T.textLight }}>
            {en?"Please let us know about any food allergies.":"Avisanos si tenés alguna alergia o intolerancia."}
          </div>
        </div>
      </div>
    </div>
  );
}
