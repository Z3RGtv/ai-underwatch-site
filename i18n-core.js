export const LANGUAGES={en:'English',pt:'Português',es:'Español',fr:'Français',de:'Deutsch',it:'Italiano',nl:'Nederlands',pl:'Polski',uk:'Українська',ru:'Русский',ar:'العربية',hi:'हिन्दी',ja:'日本語',ko:'한국어',zh:'中文',tr:'Türkçe'};
export function resolveLanguage(preferred,detected=[]){for(const item of [preferred,...detected]){const key=String(item||'').toLowerCase().split('-')[0];if(LANGUAGES[key])return key;}return 'en';}
export const normalizeText=s=>String(s).trim().replace(/\s+/g,' ');
export function messageAge(text,lang){const m=text.match(/^(\d+) (second|minute|hour|day|month|year)s? ago$/);if(text==='just now')return new Intl.RelativeTimeFormat(lang,{numeric:'auto'}).format(0,'second');return m?new Intl.RelativeTimeFormat(lang,{numeric:'auto'}).format(-Number(m[1]),m[2]):null;}
