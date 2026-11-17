/**
 * touch fish · Windows 10 伪装图标库
 * 全部为内联 SVG（viewBox 64x64），可在任意尺寸下锐利渲染。
 * 同一份定义同时供：虚拟桌面、图标库设置页、托盘图标（构建期栅格化）使用。
 */

const S = (id, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" data-icon="${id}">${body}</svg>`;

/* ---------- 系统 / Windows 10 原生风格 ---------- */

const thisPc = S('this-pc', `
<defs>
  <linearGradient id="pc-screen" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5fc6f7"/><stop offset=".55" stop-color="#1f8fe0"/><stop offset="1" stop-color="#0b5fae"/>
  </linearGradient>
  <linearGradient id="pc-frame" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#dfe6ec"/><stop offset=".5" stop-color="#b9c6d1"/><stop offset="1" stop-color="#8d9daa"/>
  </linearGradient>
</defs>
<path d="M5 9h54a3 3 0 0 1 3 3v33a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3z" fill="url(#pc-frame)" stroke="#6b7d8c" stroke-width="1.2"/>
<path d="M6.5 12h51v30h-51z" fill="url(#pc-screen)"/>
<path d="M12 17h18v3H12z" fill="#ffffff" opacity=".55"/>
<path d="M12 23h30v2.4H12z" fill="#ffffff" opacity=".3"/>
<path d="M12 28h24v2.4H12z" fill="#ffffff" opacity=".22"/>
<path d="M12 33h12v2.4H12z" fill="#ffffff" opacity=".3"/>
<path d="M27 48h10v9h9v4.4H18V57h9z" fill="#9fb0bd" stroke="#6b7d8c" stroke-width="1.1"/>
`);

const recycleBin = S('recycle-bin', `
<defs>
  <linearGradient id="rb-glass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".82"/>
    <stop offset=".45" stop-color="#c9e6f6" stop-opacity=".62"/>
    <stop offset="1" stop-color="#8fbfd8" stop-opacity=".72"/>
  </linearGradient>
  <linearGradient id="rb-lid" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f2f7fb"/><stop offset="1" stop-color="#b8cddb"/>
  </linearGradient>
</defs>
<ellipse cx="32" cy="56.5" rx="17" ry="4" fill="#1b4f76" opacity=".25"/>
<path d="M17 20h30l-3 34a3 3 0 0 1-3 2.8H23a3 3 0 0 1-3-2.8z" fill="url(#rb-glass)" stroke="#8fb6cc" stroke-width="1.4"/>
<path d="M22 26l2.4 26M32 26v26M42 26l-2.4 26" stroke="#ffffff" stroke-opacity=".75" stroke-width="2"/>
<rect x="13" y="13" width="38" height="7" rx="2.6" fill="url(#rb-lid)" stroke="#93aebd" stroke-width="1.2"/>
<path d="M26 13v-3.2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V13" fill="none" stroke="#93aebd" stroke-width="2"/>
<path d="M17 20h4l-.6 8" stroke="#ffffff" stroke-opacity=".6" stroke-width="2.4" fill="none"/>
`);

const folder = S('folder', `
<defs>
  <linearGradient id="fld-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd77a"/><stop offset="1" stop-color="#f0a92c"/></linearGradient>
  <linearGradient id="fld-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe49a"/><stop offset="1" stop-color="#f7b93e"/></linearGradient>
</defs>
<path d="M4 14a3 3 0 0 1 3-3h14l5 5h20a3 3 0 0 1 3 3v30a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="url(#fld-back)"/>
<path d="M4 22h56a2 2 0 0 1 2 2.3l-3.2 24.4a3 3 0 0 1-3 2.6H8.2a3 3 0 0 1-3-2.6L2.4 24.3A2 2 0 0 1 4 22z" fill="url(#fld-front)"/>
<path d="M6 24h52" stroke="#fff3cf" stroke-width="1.6"/>
`);

const explorer = S('explorer', `
<defs>
  <linearGradient id="exp-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd77a"/><stop offset="1" stop-color="#e8a01f"/></linearGradient>
</defs>
<path d="M4 13a3 3 0 0 1 3-3h13l4 4h19a3 3 0 0 1 3 3v31a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="url(#exp-b)"/>
<path d="M4 21h50a2 2 0 0 1 2 2v23a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#ffe9ae"/>
<path d="M13 30h30v22H13z" fill="#2c7fd0"/>
<path d="M17 34h22v2.6H17zm0 5h22v2.6H17zm0 5h14v2.6H17z" fill="#ffffff" opacity=".85"/>
<circle cx="49" cy="46" r="10" fill="#1e5fa8"/>
<path d="M45 42h8v8h-8z" fill="#ffffff"/>
`);

const settings = S('settings', `
<defs>
  <linearGradient id="set-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd0f5"/><stop offset="1" stop-color="#2f7cc4"/></linearGradient>
</defs>
<path d="M32 4l4.6 3.4 5.6-1.2 2.8 5 5.4 2 .4 5.8 3.6 4.5-2.2 5.3 1.4 5.6-4.6 3.4-2 5.5-5.8.2-4 4.2-5.4-2.2-5.7 1.2-2.7-5.1-5.3-2.2.2-5.8-3.4-4.6 2.4-5.3L10 20l4.7-3.4 2-5.5 5.8-.1 4-4.2z" fill="url(#set-g)" opacity=".95"/>
<circle cx="32" cy="30" r="13" fill="#ffffff" opacity=".95"/>
<circle cx="32" cy="30" r="7" fill="#2b6fa8"/>
`);

const store = S('store', `
<path d="M12 18h40l-3.4 36a4 4 0 0 1-4 3.6H19.4a4 4 0 0 1-4-3.6z" fill="#f2f4f6" stroke="#cfd6dc" stroke-width="1.4"/>
<path d="M22 18V14a10 10 0 0 1 20 0v4" fill="none" stroke="#9aa7b1" stroke-width="2.6"/>
<path d="M19 15l-6 26h38l-6-26z" fill="#e9edf1" opacity=".7"/>
<rect x="26" y="25" width="5" height="5" fill="#f65314"/><rect x="33" y="25" width="5" height="5" fill="#7cbb00"/>
<rect x="26" y="32" width="5" height="5" fill="#00a1f1"/><rect x="33" y="32" width="5" height="5" fill="#ffbb00"/>
`);

const cmd = S('cmd', `
<rect x="3" y="9" width="58" height="46" rx="3" fill="#0c0c0c" stroke="#4a4a4a" stroke-width="1.6"/>
<rect x="3" y="9" width="58" height="7" fill="#1f1f1f"/>
<circle cx="8.5" cy="12.5" r="1.4" fill="#ff6058"/><circle cx="13" cy="12.5" r="1.4" fill="#ffbd2e"/><circle cx="17.5" cy="12.5" r="1.4" fill="#28ca42"/>
<path d="M11 24l6 4-6 4" fill="none" stroke="#e6e6e6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M21 32h10" stroke="#e6e6e6" stroke-width="2.4"/>
<path d="M11 42h6v4h-6z" fill="#e6e6e6" opacity=".8"/>
`);

const notepad = S('notepad', `
<path d="M12 4h30l10 10v46H12z" fill="#ffffff" stroke="#c5cfd6" stroke-width="1.4"/>
<path d="M42 4l10 10H42z" fill="#e4ebf0"/>
<path d="M18 22h26v2.6H18zm0 8h26v2.6H18zm0 8h26v2.6H18zm0 8h16v2.6H18z" fill="#6f9fc4"/>
<rect x="6" y="6" width="5" height="44" rx="2" fill="#3f7cb0"/>
`);

const calculator = S('calculator', `
<rect x="8" y="3" width="48" height="58" rx="6" fill="#2f3136"/>
<rect x="13" y="8" width="38" height="13" rx="2.5" fill="#8bcf8b"/>
<g fill="#4a4d52">
  <rect x="13" y="26" width="10" height="8" rx="2"/><rect x="27" y="26" width="10" height="8" rx="2"/><rect x="41" y="26" width="10" height="8" rx="2"/>
  <rect x="13" y="38" width="10" height="8" rx="2"/><rect x="27" y="38" width="10" height="8" rx="2"/><rect x="41" y="38" width="10" height="8" rx="2"/>
  <rect x="13" y="50" width="10" height="8" rx="2"/><rect x="27" y="50" width="10" height="8" rx="2"/>
</g>
<rect x="41" y="50" width="10" height="8" rx="2" fill="#0078d7"/>
`);

const paint = S('paint', `
<path d="M31 6c15 0 27 9.4 27 21 0 7-5.4 10-11 10h-4.5c-3 0-5 2-4 5 .9 3-1 6-5 6C18 48 4 39 4 27 4 14.6 17 6 31 6z" fill="#f4f6f8" stroke="#c8d2da" stroke-width="1.4"/>
<circle cx="21" cy="19" r="4.2" fill="#e8483c"/><circle cx="34" cy="14" r="4.2" fill="#f5b83d"/>
<circle cx="45" cy="20" r="4.2" fill="#3aa757"/><circle cx="17" cy="32" r="4.2" fill="#2f7cc4"/>
<circle cx="28" cy="40" r="4.2" fill="#8a55c4"/><circle cx="43" cy="34" r="4.2" fill="#f07b3f"/>
`);

const photos = S('photos', `
<defs><linearGradient id="ph-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd15c"/><stop offset=".5" stop-color="#ff6f61"/><stop offset="1" stop-color="#b44ddb"/></linearGradient></defs>
<rect x="4" y="10" width="56" height="44" rx="4" fill="url(#ph-b)"/>
<circle cx="21" cy="24" r="5.5" fill="#fff8d6" opacity=".95"/>
<path d="M8 50l14-16 10 12 8-9 16 13z" fill="#ffffff" opacity=".55"/>
<rect x="4" y="10" width="56" height="44" rx="4" fill="none" stroke="#00000022"/>
`);

const edge = S('edge', `
<defs>
  <linearGradient id="ed-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#37d3a0"/><stop offset="1" stop-color="#0e73c7"/></linearGradient>
</defs>
<path d="M32 6c13 0 24 8 24 19 0 4-2 6-6 6H29c-6 0-9 3-9 8 0 3 2 5 6 6-2.5 3-7 5-11 5C7 50 4 41 4 33 4 17 16 6 32 6z" fill="url(#ed-a)"/>
<path d="M56 34c0 14-11 24-25 24-7 0-13-3-15-7 3 2 7 3 11 3 11 0 18-7 18-17 0-3-1-5-3-6 8 0 14 1 14 3z" fill="#0e73c7"/>
<path d="M28 25c8 0 12 2 12 6 0 1.5-1 2-3 2H21c-3 0-5 1-5 3 0 1 .6 1.6 1.6 2C12 37 10 34 10 31c0-3.5 7-6 18-6z" fill="#ffffff" opacity=".9"/>
`);

const chrome = S('chrome', `
<circle cx="32" cy="32" r="29" fill="#ffffff"/>
<path d="M32 32L3 32A29 29 0 0 1 32 3z" fill="#EA4335"/>
<path d="M32 32L46.5 6.9A29 29 0 0 1 61 32z" fill="#EA4335" opacity="0"/>
<path d="M32 32L3 32A29 29 0 0 1 32 3z" fill="#EA4335"/>
<path d="M32 32L46.5 57.1A29 29 0 0 1 3 32z" fill="#34A853"/>
<path d="M32 32L46.5 57.1A29 29 0 0 0 61 32z" fill="#FBBC05"/>
<path d="M32 32L61 32A29 29 0 0 0 46.5 6.9z" fill="#FBBC05"/>
<path d="M32 32L46.5 6.9A29 29 0 0 0 32 3z" fill="#EA4335"/>
<circle cx="32" cy="32" r="12.5" fill="#ffffff"/>
<circle cx="32" cy="32" r="9.5" fill="#4285F4"/>
`);

const firefox = S('firefox', `
<defs><radialGradient id="ff-g" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffd24a"/><stop offset=".55" stop-color="#ff8a1f"/><stop offset="1" stop-color="#d6264f"/></radialGradient></defs>
<circle cx="32" cy="33" r="27" fill="url(#ff-g)"/>
<path d="M49 15c8 8 6 20-3 25-4 2-9 2-13 1-6-1-9-5-9-9 0-6 5-9 11-8 5 1 7 4 12 2 4-2 4-7 2-11z" fill="#7b2ff7" opacity=".85"/>
<circle cx="30" cy="31" r="8" fill="#ffe9b8" opacity=".8"/>
`);

const word = S('word', `
<rect x="10" y="4" width="42" height="56" rx="3" fill="#2b579a"/>
<path d="M10 16h42M10 30h42M10 44h42" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>
<path d="M18 20l5 24 5-16 5 16 5-24" fill="none" stroke="#ffffff" stroke-width="4.4" stroke-linejoin="round" stroke-linecap="round"/>
<rect x="34" y="0" width="16" height="14" rx="2" fill="#3f74c9"/>
`);

const excel = S('excel', `
<rect x="10" y="4" width="42" height="56" rx="3" fill="#1e7145"/>
<rect x="16" y="16" width="30" height="34" fill="#ffffff" opacity=".92"/>
<path d="M16 27h30M16 38h30M26 16v34M36 16v34" stroke="#1e7145" stroke-width="1.6" opacity=".55"/>
<path d="M34 0h18v14a2 2 0 0 1-2 2H34z" fill="#2f9d63"/>
`);

const ppt = S('ppt', `
<rect x="10" y="4" width="42" height="56" rx="3" fill="#c43e1c"/>
<rect x="17" y="16" width="28" height="20" rx="2" fill="#ffffff" opacity=".95"/>
<path d="M21 32l6-9 5 6 4-4 4 7z" fill="#c43e1c" opacity=".8"/>
<rect x="17" y="41" width="28" height="4" rx="2" fill="#ffffff" opacity=".8"/>
<rect x="17" y="48" width="16" height="3" rx="1.5" fill="#ffffff" opacity=".55"/>
`);

const pdf = S('pdf', `
<path d="M12 4h28l12 12v44H12z" fill="#ffffff" stroke="#d6dee4" stroke-width="1.4"/>
<path d="M40 4l12 12H40z" fill="#eef3f6"/>
<rect x="6" y="26" width="40" height="16" rx="3" fill="#d0342c"/>
<text x="26" y="38" font-family="Segoe UI,Arial" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">PDF</text>
`);

const vscode = S('vscode', `
<path d="M44 6l12 5v42l-12 5L20 34 10 42 4 38V26l6-4 10 8z" fill="#2AA8E0"/>
<path d="M44 6L24 26l20 20 12 5V6z" fill="#0F7BB8"/>
<path d="M4 26v12l8-6z" fill="#3cc1f0"/>
`);

const steam = S('steam', `
<circle cx="32" cy="32" r="29" fill="#1b2838"/>
<circle cx="40" cy="24" r="10" fill="#c7d5e0"/>
<circle cx="40" cy="24" r="6" fill="#1b2838"/>
<circle cx="22" cy="40" r="7" fill="#66c0f4"/>
<path d="M8 44l14-5" stroke="#c7d5e0" stroke-width="4" stroke-linecap="round"/>
`);

const wechat = S('wechat', `
<ellipse cx="25" cy="26" rx="19" ry="15" fill="#4ac05a"/>
<path d="M14 37l-1 8 8-5" fill="#4ac05a"/>
<circle cx="19" cy="23" r="2.2" fill="#ffffff"/><circle cx="31" cy="23" r="2.2" fill="#ffffff"/>
<ellipse cx="42" cy="38" rx="15" ry="12" fill="#7cdc8a"/>
<path d="M50 47l1 7-7-4" fill="#7cdc8a"/>
<circle cx="37" cy="36" r="1.8" fill="#ffffff"/><circle cx="47" cy="36" r="1.8" fill="#ffffff"/>
`);

const qq = S('qq', `
<ellipse cx="32" cy="36" rx="18" ry="21" fill="#12b7f5"/>
<ellipse cx="32" cy="40" rx="10" ry="11" fill="#ffffff"/>
<circle cx="25" cy="27" r="4.6" fill="#ffffff"/><circle cx="39" cy="27" r="4.6" fill="#ffffff"/>
<circle cx="25" cy="27" r="2" fill="#111"/><circle cx="39" cy="27" r="2" fill="#111"/>
<path d="M16 20l-6-6 9 2z" fill="#12b7f5"/><path d="M48 20l6-6-9 2z" fill="#12b7f5"/>
<path d="M32 45l4 4h-8z" fill="#f7b733"/>
`);

const dingtalk = S('dingtalk', `
<rect x="4" y="4" width="56" height="56" rx="13" fill="#0089ff"/>
<path d="M40 14L20 34h10l-6 16 20-21H33z" fill="#ffffff"/>
`);

const netease = S('netease', `
<circle cx="32" cy="32" r="28" fill="#e60026"/>
<circle cx="32" cy="32" r="12" fill="none" stroke="#ffffff" stroke-width="3"/>
<path d="M32 20v24a6 6 0 1 1-4-5.7" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
`);

const bilibili = S('bilibili', `
<rect x="4" y="14" width="56" height="40" rx="9" fill="#fb7299"/>
<path d="M18 12l7 6M46 12l-7 6" stroke="#fb7299" stroke-width="4" stroke-linecap="round"/>
<rect x="14" y="24" width="14" height="12" rx="3" fill="#ffffff" opacity=".92"/>
<rect x="36" y="24" width="14" height="12" rx="3" fill="#ffffff" opacity=".92"/>
<path d="M22 46h20" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>
`);

const youtube = S('youtube', `
<rect x="3" y="14" width="58" height="36" rx="10" fill="#ff0000"/>
<path d="M27 24l14 8-14 8z" fill="#ffffff"/>
`);

const novel = S('novel', `
<path d="M8 10a4 4 0 0 1 4-4h20v52H12a4 4 0 0 1-4-4z" fill="#f0f4f8" stroke="#c3d0da" stroke-width="1.4"/>
<path d="M32 6h20a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H32z" fill="#dfe8ef" stroke="#c3d0da" stroke-width="1.4"/>
<path d="M36 16h14v2.6H36zm0 7h14v2.6H36zm0 7h14v2.6H36zm0 7h9v2.6h-9z" fill="#8aa6ba"/>
<path d="M13 16h13v2.6H13zm0 7h13v2.6H13zm0 7h9v2.6h-9z" fill="#a9bccb"/>
<rect x="30" y="4" width="4" height="56" fill="#2f7cc4"/>
`);

const video = S('video', `
<rect x="3" y="14" width="40" height="36" rx="5" fill="#2b3a48"/>
<path d="M43 26l18-9v30l-18-9z" fill="#4a6172"/>
<path d="M13 22h12v3H13zm0 7h18v3H13z" fill="#ffffff" opacity=".35"/>
<circle cx="12" cy="44" r="3" fill="#e8483c"/>
`);

const music = S('music', `
<circle cx="32" cy="32" r="28" fill="#2a2f3a"/>
<circle cx="32" cy="32" r="9" fill="#8f9aa6"/><circle cx="32" cy="32" r="3" fill="#2a2f3a"/>
<path d="M44 16v18a7 7 0 1 1-4-6.4V20l-12 3v16a7 7 0 1 1-4-6.4V18z" fill="#f0f3f6"/>
`);

const mail = S('mail', `
<rect x="4" y="14" width="56" height="36" rx="4" fill="#0f6cbd"/>
<path d="M4 18l28 20 28-20" fill="none" stroke="#ffffff" stroke-width="3"/>
<path d="M4 46l20-14M60 46L40 32" stroke="#ffffff" stroke-opacity=".5" stroke-width="2"/>
`);

const games = S('games', `
<path d="M18 20h28a14 14 0 0 1 14 14v6a10 10 0 0 1-18 6l-2-3h-16l-2 3a10 10 0 0 1-18-6v-6a14 14 0 0 1 14-14z" fill="#3a3f47"/>
<circle cx="22" cy="31" r="3.6" fill="#8ce06a"/><circle cx="14" cy="39" r="3.6" fill="#f0c04a"/>
<circle cx="48" cy="31" r="3.4" fill="#e8483c"/><circle cx="54" cy="39" r="3.4" fill="#4aa3e8"/>
`);

const shield = S('shield', `
<path d="M32 4l24 8v18c0 14-10 24-24 30C18 54 8 44 8 30V12z" fill="#2f9d63"/>
<path d="M32 10l18 6v14c0 11-7.6 19-18 24-10.4-5-18-13-18-24V16z" fill="#3dbb7a"/>
<path d="M22 32l7 7 14-14" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
`);

const link = S('link', `
<rect x="4" y="4" width="56" height="56" rx="10" fill="#e8eef4"/>
<path d="M24 34a7 7 0 0 1 0-10l6-6a7 7 0 0 1 10 10l-3 3" fill="none" stroke="#2f7cc4" stroke-width="4.4" stroke-linecap="round"/>
<path d="M40 30a7 7 0 0 1 0 10l-6 6a7 7 0 0 1-10-10l3-3" fill="none" stroke="#2f7cc4" stroke-width="4.4" stroke-linecap="round"/>
`);

const txt = S('txt', `
<path d="M12 4h28l12 12v44H12z" fill="#ffffff" stroke="#c5cfd6" stroke-width="1.4"/>
<path d="M40 4l12 12H40z" fill="#e9f0f5"/>
<path d="M18 24h24v2.6H18zm0 8h24v2.6H18zm0 8h24v2.6H18z" fill="#9bb3c4"/>
`);

const whale = S('whale', `
<circle cx="32" cy="32" r="30" fill="#0b7fe0"/>
<path d="M10 34c0-8 7-14 16-14 8 0 13 4 15 9l6-4v14l-6-4c-2 7-7 11-15 11-9 0-16-4-16-12z" fill="#ffffff"/>
<circle cx="22" cy="30" r="2.6" fill="#0b3f6e"/>
<path d="M14 42c6 4 16 4 22 0" stroke="#7fd0ff" stroke-width="3" fill="none" stroke-linecap="round"/>
`);

/* ---------- 图标库元数据 ---------- */

const ICONS = [
  { id: 'this-pc', label: '此电脑', group: '系统', svg: thisPc },
  { id: 'recycle-bin', label: '回收站', group: '系统', svg: recycleBin },
  { id: 'folder', label: '文件夹', group: '系统', svg: folder },
  { id: 'explorer', label: '文件资源管理器', group: '系统', svg: explorer },
  { id: 'drive', label: '本地磁盘', group: '系统', svg: explorer },
  { id: 'user', label: '用户文件夹', group: '系统', svg: folder },
  { id: 'pictures', label: '图片', group: '系统', svg: photos },
  { id: 'downloads', label: '下载', group: '系统', svg: folder },
  { id: 'settings', label: '设置', group: '系统', svg: settings },
  { id: 'store', label: 'Microsoft Store', group: '系统', svg: store },
  { id: 'cmd', label: '命令提示符', group: '系统', svg: cmd },
  { id: 'notepad', label: '记事本', group: '系统', svg: notepad },
  { id: 'calculator', label: '计算器', group: '系统', svg: calculator },
  { id: 'paint', label: '画图', group: '系统', svg: paint },
  { id: 'photos', label: '照片', group: '系统', svg: photos },
  { id: 'txt', label: '文本文档', group: '系统', svg: txt },
  { id: 'shield', label: 'Windows 安全中心', group: '系统', svg: shield },
  { id: 'mail', label: '邮件', group: '系统', svg: mail },
  { id: 'music', label: '音乐播放器', group: '系统', svg: music },
  { id: 'video', label: '视频播放器', group: '系统', svg: video },
  { id: 'games', label: '游戏', group: '系统', svg: games },
  { id: 'edge', label: 'Microsoft Edge', group: '软件', svg: edge },
  { id: 'chrome', label: 'Google Chrome', group: '软件', svg: chrome },
  { id: 'firefox', label: 'Firefox', group: '软件', svg: firefox },
  { id: 'vscode', label: 'Visual Studio Code', group: '软件', svg: vscode },
  { id: 'steam', label: 'Steam', group: '软件', svg: steam },
  { id: 'word', label: 'Word', group: '办公', svg: word },
  { id: 'excel', label: 'Excel', group: '办公', svg: excel },
  { id: 'ppt', label: 'PowerPoint', group: '办公', svg: ppt },
  { id: 'pdf', label: 'PDF 文档', group: '办公', svg: pdf },
  { id: 'wechat', label: '微信', group: '通讯', svg: wechat },
  { id: 'qq', label: 'QQ', group: '通讯', svg: qq },
  { id: 'dingtalk', label: '钉钉', group: '通讯', svg: dingtalk },
  { id: 'netease', label: '网易云音乐', group: '娱乐', svg: netease },
  { id: 'bilibili', label: '哔哩哔哩', group: '娱乐', svg: bilibili },
  { id: 'youtube', label: 'YouTube', group: '娱乐', svg: youtube },
  { id: 'novel', label: '小说阅读', group: '娱乐', svg: novel },
  { id: 'link', label: '网站快捷方式', group: '通用', svg: link },
  { id: 'whale', label: 'touch fish', group: '通用', svg: whale }
];

const ICON_MAP = Object.fromEntries(ICONS.map((i) => [i.id, i]));

function iconSvg(id) {
  const item = ICON_MAP[id];
  return (item || ICON_MAP.link).svg;
}

function iconDataUrl(id) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(id));
}

/* ---------- 真实 Windows 10 系统图标（由 tools/extract-icons.py 从系统提取） ---------- */
const REAL_FILES = {
  'this-pc': 'this-pc.png',
  'recycle-bin': 'recycle-bin.png',
  'network': 'network.png',
  'explorer': 'explorer.png',
  'edge': 'edge.png',
  'notepad': 'notepad.png',
  'cmd': 'cmd.png',
  'paint': 'paint.png',
  'calculator': 'calc-uwp.png',
  'settings': 'settings-uwp.png',
  'folder': 'folder.png',
  'drive': 'drive.png',
  'user': 'user.png',
  'pictures': 'pictures.png',
  'downloads': 'downloads.png',
  'store': 'store.png',
  'photos': 'photos.png',
  'mail': 'mail.png',
  'music': 'music.png',
  'video': 'video.png'
};

ICONS.forEach((item) => {
  if (REAL_FILES[item.id]) item.file = 'assets/icons/png/' + REAL_FILES[item.id];
});

module.exports = { ICONS, ICON_MAP, iconSvg, iconDataUrl, REAL_FILES };
