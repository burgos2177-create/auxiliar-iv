#!/usr/bin/env python3
"""Inject IV Ingenierías auth gate into built index.html - uses rfind to find the REAL <body> tag"""
import sys

LOGIN_BLOCK = '''<!-- IV Auth Gate -->
<div id="iv-auth-gate" style="position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);font-family:Arial,sans-serif">
<div style="background:#fff;border-radius:16px;padding:48px 40px;width:360px;box-shadow:0 24px 64px rgba(0,0,0,0.3);text-align:center">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 170" width="120" style="margin:0 auto 24px;display:block">
<rect x="18" y="10" width="22" height="90" fill="#1a1a2e"/><rect x="8" y="10" width="42" height="14" fill="#1a1a2e"/>
<rect x="8" y="86" width="42" height="14" fill="#1a1a2e"/><polygon points="52,10 74,10 110,100 88,100" fill="#1a1a2e"/>
<polygon points="148,10 170,10 128,100 106,100" fill="#1a1a2e"/>
<rect x="111" y="28" width="10" height="52" rx="4" transform="rotate(-18,116,54)" fill="#4ecac4"/>
<rect x="127" y="24" width="10" height="52" rx="4" transform="rotate(-18,132,50)" fill="#8a9ab0"/>
<text x="100" y="148" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="5" fill="#1a1a2e">INGENIER&#205;AS</text>
</svg>
<h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1a1a2e">Auxiliar IV</h2>
<p style="margin:0 0 24px;font-size:12px;color:#6b7280">Uso exclusivo de IV Ingenier&#237;as</p>
<div id="iv-err" style="display:none;margin-bottom:12px;padding:8px 12px;border-radius:8px;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;font-size:12px">Credenciales incorrectas</div>
<form id="iv-frm" style="display:flex;flex-direction:column;gap:12px">
<input id="iv-u" type="text" placeholder="Usuario" style="padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none"/>
<input id="iv-p" type="password" placeholder="Contrase&#241;a" style="padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none"/>
<button type="submit" style="padding:12px;border:none;border-radius:8px;background:#1a7a5e;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Ingresar</button>
</form>
<p style="margin:16px 0 0;font-size:10px;color:#9ca3af">v0.2 &#183; NTC-2023</p>
</div></div>
<script>
(function(){
var K="iv_auth_ok";
if(sessionStorage.getItem(K)==="1"){document.getElementById("iv-auth-gate").style.display="none"}
document.getElementById("iv-frm").addEventListener("submit",function(e){
e.preventDefault();
var u=document.getElementById("iv-u").value.trim();
var p=document.getElementById("iv-p").value;
if(u==="admin"&&p==="huicholes"){
sessionStorage.setItem(K,"1");
document.getElementById("iv-auth-gate").style.display="none";
}else{
document.getElementById("iv-err").style.display="block";
document.getElementById("iv-p").value="";
}
});
})();
</script>
'''

src = sys.argv[1]
dst = sys.argv[2] if len(sys.argv) > 2 else src

with open(src, 'r', encoding='utf-8') as f:
    html = f.read()

# Use rfind to find the LAST <body> — the real HTML one, not the ones inside JS strings
idx = html.rfind('<body>')
if idx == -1:
    print("ERROR: <body> not found")
    sys.exit(1)

insert_at = idx + len('<body>')
out = html[:insert_at] + '\n' + LOGIN_BLOCK + '\n' + html[insert_at:]

with open(dst, 'w', encoding='utf-8') as f:
    f.write(out)

print(f"OK: auth injected at position {idx} into {dst} ({len(out):,} bytes)")
