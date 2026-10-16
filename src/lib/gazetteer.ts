/**
 * Prosty gazeter do geotagowania nagłówków (GDELT DOC API nie zwraca współrzędnych).
 * Kolejność ma znaczenie: bardziej szczegółowe hasła (miasta, cieśniny) przed krajami.
 * Łatwo rozszerzyć — dopisz wpis z listą słów kluczowych (małymi literami).
 */
export interface Place {
  name: string;
  keys: string[];
  lat: number;
  lon: number;
  region: string;
}

export const PLACES: Place[] = [
  // Cieśniny / akweny
  { name: 'Strait of Hormuz', keys: ['strait of hormuz', 'hormuz'], lat: 26.57, lon: 56.25, region: 'Middle East' },
  { name: 'Red Sea / Bab el-Mandeb', keys: ['bab el-mandeb', 'bab al-mandab', 'red sea'], lat: 14.5, lon: 42.0, region: 'Middle East' },
  { name: 'Suez Canal', keys: ['suez'], lat: 30.5, lon: 32.35, region: 'Middle East' },
  { name: 'Taiwan Strait', keys: ['taiwan strait'], lat: 24.5, lon: 119.5, region: 'Asia-Pacific' },
  { name: 'South China Sea', keys: ['south china sea', 'spratly', 'scarborough'], lat: 12.0, lon: 114.0, region: 'Asia-Pacific' },
  { name: 'Black Sea', keys: ['black sea'], lat: 43.4, lon: 34.0, region: 'Europe' },
  { name: 'Strait of Malacca', keys: ['malacca'], lat: 2.5, lon: 101.3, region: 'Asia-Pacific' },
  { name: 'Panama Canal', keys: ['panama canal'], lat: 9.08, lon: -79.68, region: 'Americas' },
  { name: 'Bosphorus', keys: ['bosphorus', 'bosporus', 'turkish straits'], lat: 41.12, lon: 29.07, region: 'Europe' },
  // Miasta / regiony konfliktów
  { name: 'Gaza', keys: ['gaza', 'rafah', 'khan younis', 'hamas'], lat: 31.45, lon: 34.4, region: 'Middle East' },
  { name: 'West Bank', keys: ['west bank', 'jenin', 'ramallah'], lat: 31.95, lon: 35.25, region: 'Middle East' },
  { name: 'Lebanon', keys: ['lebanon', 'beirut', 'hezbollah'], lat: 33.89, lon: 35.5, region: 'Middle East' },
  { name: 'Yemen', keys: ['yemen', 'houthi', 'sanaa', 'hodeidah'], lat: 15.37, lon: 44.19, region: 'Middle East' },
  { name: 'Tehran', keys: ['tehran'], lat: 35.69, lon: 51.39, region: 'Middle East' },
  { name: 'Iran', keys: ['iran', 'iranian', 'irgc'], lat: 32.4, lon: 53.7, region: 'Middle East' },
  { name: 'Israel', keys: ['israel', 'israeli', 'idf', 'tel aviv', 'jerusalem', 'netanyahu'], lat: 31.77, lon: 35.21, region: 'Middle East' },
  { name: 'Syria', keys: ['syria', 'damascus', 'aleppo', 'idlib'], lat: 34.8, lon: 38.99, region: 'Middle East' },
  { name: 'Iraq', keys: ['iraq', 'baghdad', 'erbil'], lat: 33.31, lon: 44.36, region: 'Middle East' },
  { name: 'Saudi Arabia', keys: ['saudi', 'riyadh', 'aramco'], lat: 24.71, lon: 46.68, region: 'Middle East' },
  { name: 'Qatar', keys: ['qatar', 'doha'], lat: 25.29, lon: 51.53, region: 'Middle East' },
  { name: 'UAE', keys: ['uae', 'emirates', 'abu dhabi', 'dubai'], lat: 24.45, lon: 54.38, region: 'Middle East' },
  { name: 'Turkey', keys: ['turkey', 'türkiye', 'turkish', 'ankara', 'erdogan'], lat: 39.93, lon: 32.86, region: 'Europe' },
  { name: 'Kyiv', keys: ['kyiv', 'kiev'], lat: 50.45, lon: 30.52, region: 'Europe' },
  { name: 'Kharkiv', keys: ['kharkiv'], lat: 49.99, lon: 36.23, region: 'Europe' },
  { name: 'Donbas', keys: ['donbas', 'donetsk', 'luhansk', 'bakhmut', 'pokrovsk', 'zaporizhzhia'], lat: 48.0, lon: 37.8, region: 'Europe' },
  { name: 'Crimea', keys: ['crimea', 'sevastopol'], lat: 44.95, lon: 34.1, region: 'Europe' },
  { name: 'Odesa', keys: ['odesa', 'odessa'], lat: 46.48, lon: 30.72, region: 'Europe' },
  { name: 'Ukraine', keys: ['ukraine', 'ukrainian', 'zelensky'], lat: 49.0, lon: 31.4, region: 'Europe' },
  { name: 'Moscow', keys: ['moscow', 'kremlin'], lat: 55.76, lon: 37.62, region: 'Europe' },
  { name: 'Russia', keys: ['russia', 'russian', 'putin'], lat: 56.0, lon: 45.0, region: 'Europe' },
  { name: 'Belarus', keys: ['belarus', 'minsk', 'lukashenko'], lat: 53.9, lon: 27.56, region: 'Europe' },
  { name: 'Poland', keys: ['poland', 'polish', 'warsaw'], lat: 52.23, lon: 21.01, region: 'Europe' },
  { name: 'Baltics', keys: ['baltic', 'estonia', 'latvia', 'lithuania', 'kaliningrad'], lat: 56.9, lon: 24.1, region: 'Europe' },
  { name: 'Brussels / EU', keys: ['european union', 'brussels', 'eu ', 'european commission', 'nato'], lat: 50.85, lon: 4.35, region: 'Europe' },
  { name: 'Germany', keys: ['germany', 'german', 'berlin'], lat: 52.52, lon: 13.4, region: 'Europe' },
  { name: 'France', keys: ['france', 'french', 'paris', 'macron'], lat: 48.86, lon: 2.35, region: 'Europe' },
  { name: 'United Kingdom', keys: ['britain', 'british', 'uk ', 'london', 'starmer'], lat: 51.51, lon: -0.13, region: 'Europe' },
  { name: 'Switzerland', keys: ['switzerland', 'swiss', 'zurich'], lat: 47.37, lon: 8.54, region: 'Europe' },
  { name: 'Taiwan', keys: ['taiwan', 'taipei'], lat: 25.03, lon: 121.56, region: 'Asia-Pacific' },
  { name: 'Beijing', keys: ['beijing', 'xi jinping', 'pboc'], lat: 39.9, lon: 116.4, region: 'Asia-Pacific' },
  { name: 'Shanghai', keys: ['shanghai'], lat: 31.23, lon: 121.47, region: 'Asia-Pacific' },
  { name: 'Hong Kong', keys: ['hong kong'], lat: 22.32, lon: 114.17, region: 'Asia-Pacific' },
  { name: 'China', keys: ['china', 'chinese'], lat: 35.0, lon: 105.0, region: 'Asia-Pacific' },
  { name: 'North Korea', keys: ['north korea', 'pyongyang', 'kim jong'], lat: 39.03, lon: 125.75, region: 'Asia-Pacific' },
  { name: 'South Korea', keys: ['south korea', 'seoul'], lat: 37.57, lon: 126.98, region: 'Asia-Pacific' },
  { name: 'Japan', keys: ['japan', 'japanese', 'tokyo', 'boj'], lat: 35.68, lon: 139.69, region: 'Asia-Pacific' },
  { name: 'Philippines', keys: ['philippines', 'manila'], lat: 14.6, lon: 120.98, region: 'Asia-Pacific' },
  { name: 'India', keys: ['india', 'indian', 'new delhi', 'mumbai', 'modi'], lat: 28.61, lon: 77.21, region: 'Asia-Pacific' },
  { name: 'Pakistan', keys: ['pakistan', 'islamabad', 'kashmir'], lat: 33.68, lon: 73.05, region: 'Asia-Pacific' },
  { name: 'Afghanistan', keys: ['afghanistan', 'kabul', 'taliban'], lat: 34.53, lon: 69.17, region: 'Asia-Pacific' },
  { name: 'Myanmar', keys: ['myanmar', 'burma'], lat: 19.76, lon: 96.07, region: 'Asia-Pacific' },
  { name: 'Australia', keys: ['australia', 'australian', 'canberra', 'sydney'], lat: -35.28, lon: 149.13, region: 'Asia-Pacific' },
  { name: 'Sudan', keys: ['sudan', 'khartoum', 'darfur'], lat: 15.5, lon: 32.56, region: 'Africa' },
  { name: 'Sahel', keys: ['mali', 'niger', 'burkina faso', 'sahel'], lat: 14.0, lon: 0.0, region: 'Africa' },
  { name: 'DR Congo', keys: ['congo', 'kinshasa', 'goma', 'm23'], lat: -1.68, lon: 29.22, region: 'Africa' },
  { name: 'Libya', keys: ['libya', 'tripoli', 'benghazi'], lat: 32.89, lon: 13.19, region: 'Africa' },
  { name: 'Egypt', keys: ['egypt', 'cairo'], lat: 30.04, lon: 31.24, region: 'Africa' },
  { name: 'Somalia', keys: ['somalia', 'mogadishu', 'al-shabaab'], lat: 2.05, lon: 45.32, region: 'Africa' },
  { name: 'Ethiopia', keys: ['ethiopia', 'addis ababa', 'tigray', 'amhara'], lat: 9.03, lon: 38.74, region: 'Africa' },
  { name: 'South Africa', keys: ['south africa', 'johannesburg', 'pretoria'], lat: -25.75, lon: 28.19, region: 'Africa' },
  { name: 'Ghana', keys: ['ghana', 'accra'], lat: 5.6, lon: -0.19, region: 'Africa' },
  { name: 'Venezuela', keys: ['venezuela', 'caracas', 'maduro'], lat: 10.48, lon: -66.9, region: 'Americas' },
  { name: 'Mexico', keys: ['mexico', 'mexican'], lat: 19.43, lon: -99.13, region: 'Americas' },
  { name: 'Canada', keys: ['canada', 'canadian', 'ottawa'], lat: 45.42, lon: -75.7, region: 'Americas' },
  { name: 'Brazil', keys: ['brazil', 'brasilia', 'lula'], lat: -15.79, lon: -47.88, region: 'Americas' },
  { name: 'Argentina', keys: ['argentina', 'buenos aires', 'milei'], lat: -34.6, lon: -58.38, region: 'Americas' },
  { name: 'Cuba', keys: ['cuba', 'havana'], lat: 23.11, lon: -82.37, region: 'Americas' },
  { name: 'Washington', keys: ['white house', 'pentagon', 'washington', 'congress', 'trump', 'biden', 'federal reserve', 'treasury'], lat: 38.9, lon: -77.04, region: 'Americas' },
  { name: 'New York', keys: ['new york', 'wall street', 'comex', 'nyse'], lat: 40.71, lon: -74.01, region: 'Americas' },
  { name: 'United States', keys: ['united states', 'u.s.', ' us ', 'american'], lat: 39.5, lon: -98.35, region: 'Americas' },
];

const SORTED = PLACES.flatMap((p) => p.keys.map((k) => ({ k, p }))).sort((a, b) => b.k.length - a.k.length);

/** Zwraca najlepiej pasujące miejsce: najwcześniej występujące w tytule, przy remisie dłuższe hasło. */
export function geocodeTitle(title: string): Place | null {
  const t = ` ${title.toLowerCase()} `;
  let best: { idx: number; len: number; p: Place } | null = null;
  for (const { k, p } of SORTED) {
    const idx = t.indexOf(k);
    if (idx < 0) continue;
    if (!best || idx < best.idx || (idx === best.idx && k.length > best.len)) best = { idx, len: k.length, p };
  }
  return best?.p ?? null;
}

/** Centroidy krajów źródłowych GDELT (pole `sourcecountry`) — awaryjne, przybliżone położenie. */
export const SOURCE_COUNTRY: Record<string, [number, number]> = {
  'United States': [-98.35, 39.5],
  'United Kingdom': [-1.5, 52.5],
  India: [78.9, 22.0],
  Australia: [134.0, -25.0],
  Canada: [-100.0, 56.0],
  Germany: [10.4, 51.2],
  France: [2.2, 46.6],
  China: [105.0, 35.0],
  Japan: [138.0, 37.0],
  Singapore: [103.82, 1.35],
  'Hong Kong': [114.17, 22.32],
  'United Arab Emirates': [54.4, 24.4],
  'South Africa': [24.0, -29.0],
  Nigeria: [8.0, 9.5],
  Pakistan: [70.0, 30.0],
  Philippines: [122.0, 12.0],
  Ireland: [-8.0, 53.4],
  Israel: [35.0, 31.5],
  Switzerland: [8.2, 46.8],
  Turkey: [35.0, 39.0],
  Malaysia: [102.0, 4.2],
  'New Zealand': [174.0, -41.0],
  Kenya: [37.9, 0.0],
  Ghana: [-1.0, 7.9],
  Russia: [45.0, 56.0],
  Ukraine: [31.4, 49.0],
  Poland: [19.1, 52.0],
};
