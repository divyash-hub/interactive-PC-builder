// Parts catalog: a short, curated list of well-known parts so beginners aren't
// buried in options. Prices are approximate street prices (Nov 2026); the Buy
// link always opens the live listing. Photos are the makers' official product
// images (see img/CREDITS.md).
// Scores are relative: CPU gaming / multi-thread vs Ryzen 5 7600 = 100,
// GPU 1080p raster vs RTX 4060 = 100.

export const CATALOG_UPDATED = 'Nov 2026';

// Put your Amazon Associates tags here to earn on referrals (e.g. 'coreframe-21').
export const AFFILIATE = { inr: '', usd: '' };

// The order here is the order a beginner is walked through.
export const CATEGORIES = [
  { key: 'cpu',     label: 'Processor',     short: 'CPU',     required: true,
    what: 'The brain of the PC. It runs everything and decides which motherboards you can use.',
    tip: 'For gaming, the Ryzen 7 X3D chips are the fastest. The Ryzen 5 7600 is the best value.' },
  { key: 'mobo',    label: 'Motherboard',   short: 'Board',   required: true,
    what: 'The board everything plugs into. It has to match your processor’s socket.',
    tip: 'Pick the cheapest one that fits. Expensive boards rarely add speed.' },
  { key: 'ram',     label: 'Memory (RAM)',  short: 'RAM',     required: true,
    what: 'Short-term memory for games and apps. More lets you keep more open at once.',
    tip: '32GB is the sweet spot today. 16GB is fine on a tight budget.' },
  { key: 'gpu',     label: 'Graphics card', short: 'GPU',     required: false,
    what: 'Draws every frame you see. For gaming, it matters more than any other part.',
    tip: 'Spend the biggest share of a gaming budget here.' },
  { key: 'storage', label: 'Storage',       short: 'Storage', required: true, multi: 3,
    what: 'Where Windows, games and files live. NVMe drives are the fast ones.',
    tip: 'A 1–2TB NVMe drive suits most people. Add a hard drive for cheap bulk space.' },
  { key: 'cooler',  label: 'CPU cooler',    short: 'Cooler',  required: false,
    what: 'Keeps the processor cool and quiet. Some processors come with one in the box.',
    tip: 'A good air cooler is quiet, cheap and never leaks.' },
  { key: 'psu',     label: 'Power supply',  short: 'PSU',     required: true,
    what: 'Turns wall power into what the parts need. A weak one can shut the PC off.',
    tip: 'We show how much you need. Gold-rated units run cooler and quieter.' },
  { key: 'case',    label: 'Case',          short: 'Case',    required: true,
    what: 'The box everything goes in. It sets how big your graphics card and cooler can be.',
    tip: 'Mesh fronts breathe better and keep parts cooler.' },
];

const p = (inr, usd) => ({ inr, usd });
const img = id => `img/parts/${id}.webp`;

export const PARTS = {
  cpu: [
    { id: 'i5-12400f',  name: 'Intel Core i5-12400F',    brand: 'Intel', socket: 'LGA1700', mem: ['DDR4','DDR5'], cores: 6, threads: 12, boost: 4.4, tdp: 65, draw: 90, game: 85, mt: 82, igpu: false, boxCooler: true, price: p(10500, 115),
      blurb: 'Budget gaming favourite. Needs a graphics card.' },
    { id: 'r5-7600',    name: 'AMD Ryzen 5 7600',        brand: 'AMD',   socket: 'AM5', mem: ['DDR5'], cores: 6, threads: 12, boost: 5.1, tdp: 65, draw: 88, game: 100, mt: 100, igpu: true, boxCooler: true, price: p(17500, 189), bg: '#111111',
      blurb: 'Best value. Cooler included, easy to upgrade later.' },
    { id: 'u7-265k',    name: 'Intel Core Ultra 7 265K', brand: 'Intel', socket: 'LGA1851', mem: ['DDR5'], cores: 20, threads: 20, boost: 5.5, tdp: 125, draw: 250, game: 110, mt: 235, igpu: true, boxCooler: false, price: p(33000, 289),
      blurb: 'Lots of cores for editing and multitasking.' },
    { id: 'r7-7800x3d', name: 'AMD Ryzen 7 7800X3D',     brand: 'AMD',   socket: 'AM5', mem: ['DDR5'], cores: 8, threads: 16, boost: 5.0, tdp: 120, draw: 90, game: 128, mt: 130, igpu: true, boxCooler: false, price: p(36000, 379), bg: '#111111',
      blurb: 'A top gaming chip that sips power.' },
    { id: 'r7-9800x3d', name: 'AMD Ryzen 7 9800X3D',     brand: 'AMD',   socket: 'AM5', mem: ['DDR5'], cores: 8, threads: 16, boost: 5.2, tdp: 120, draw: 110, game: 142, mt: 150, igpu: true, boxCooler: false, price: p(47000, 479), bg: '#111111',
      blurb: 'The fastest gaming processor you can buy.' },
    { id: 'r9-9950x',   name: 'AMD Ryzen 9 9950X',       brand: 'AMD',   socket: 'AM5', mem: ['DDR5'], cores: 16, threads: 32, boost: 5.7, tdp: 170, draw: 200, game: 115, mt: 290, igpu: true, boxCooler: false, price: p(55000, 549), bg: '#111111',
      blurb: 'Workstation power for 3D, video and code.' },
  ],

  mobo: [
    { id: 'b760m-p-d4', name: 'MSI PRO B760M-P DDR4',               socket: 'LGA1700', chipset: 'B760', form: 'mATX', mem: 'DDR4', dimms: 4, m2: 2, wifi: false, price: p(9500, 99),
      blurb: 'No-frills Intel board that uses cheaper DDR4.' },
    { id: 'b650-gp',    name: 'MSI B650 GAMING PLUS WIFI',          socket: 'AM5', chipset: 'B650', form: 'ATX', mem: 'DDR5', dimms: 4, m2: 2, wifi: true, price: p(16500, 169),
      blurb: 'Solid AMD board with Wi-Fi. Fits most builds.' },
    { id: 'b850-i',     name: 'ASUS ROG STRIX B850-I GAMING WIFI',  socket: 'AM5', chipset: 'B850', form: 'ITX', mem: 'DDR5', dimms: 2, m2: 2, wifi: true, price: p(30000, 299),
      blurb: 'Tiny board for small cases.' },
    { id: 'z890-tuf',   name: 'ASUS TUF GAMING Z890-PLUS WIFI',     socket: 'LGA1851', chipset: 'Z890', form: 'ATX', mem: 'DDR5', dimms: 4, m2: 4, wifi: true, price: p(32000, 299),
      blurb: 'Tough board for Intel Core Ultra chips.' },
    { id: 'x870e-e',    name: 'ASUS ROG STRIX X870E-E GAMING WIFI', socket: 'AM5', chipset: 'X870E', form: 'ATX', mem: 'DDR5', dimms: 4, m2: 5, wifi: true, price: p(50000, 479),
      blurb: 'Premium AMD board with room for five SSDs.' },
  ],

  ram: [
    { id: 'd4-16-3200', name: 'Corsair Vengeance LPX 16GB (2×8) DDR4-3200', type: 'DDR4', size: 16, speed: 3200, sticks: 2, price: p(4500, 49),
      blurb: 'For DDR4 boards on a budget.' },
    { id: 'd5-16-5600', name: 'Kingston FURY Beast 16GB (2×8) DDR5-5600',   type: 'DDR5', size: 16, speed: 5600, sticks: 2, price: p(7500, 89), bg: '#ffffff',
      blurb: 'Entry DDR5. Enough for everyday use.' },
    { id: 'd5-32-6000', name: 'Corsair Vengeance 32GB (2×16) DDR5-6000',    type: 'DDR5', size: 32, speed: 6000, sticks: 2, price: p(14500, 169),
      blurb: 'The sweet spot for gaming in 2026.' },
    { id: 'd5-64-6000', name: 'Corsair Vengeance 64GB (2×32) DDR5-6000',    type: 'DDR5', size: 64, speed: 6000, sticks: 2, price: p(28000, 329),
      blurb: 'For video editing, big projects and VMs.' },
  ],

  gpu: [
    { id: 'rx7600',    name: 'AMD Radeon RX 7600 8GB',          brand: 'AMD',    vram: 8,  length: 204, tdp: 165, score: 98,  price: p(24000, 249), bg: '#ffffff',
      blurb: 'Smooth 1080p gaming on a budget.' },
    { id: 'rtx5060',   name: 'NVIDIA GeForce RTX 5060 8GB',     brand: 'NVIDIA', vram: 8,  length: 245, tdp: 145, score: 120, price: p(29000, 299), bg: '#000000',
      blurb: 'Great 1080p card with DLSS.' },
    { id: 'rx9060xt',  name: 'AMD Radeon RX 9060 XT 16GB',      brand: 'AMD',    vram: 16, length: 280, tdp: 160, score: 135, price: p(36000, 359), bg: '#111111',
      blurb: '16GB of memory, so it ages well.' },
    { id: 'rtx5070',   name: 'NVIDIA GeForce RTX 5070 12GB',    brand: 'NVIDIA', vram: 12, length: 260, tdp: 250, score: 180, price: p(57000, 549), bg: '#000000',
      blurb: 'Fast 1440p gaming.' },
    { id: 'rx9070xt',  name: 'AMD Radeon RX 9070 XT 16GB',      brand: 'AMD',    vram: 16, length: 305, tdp: 304, score: 215, price: p(68000, 659), bg: '#111111',
      blurb: 'The 1440p value champion.' },
    { id: 'rtx5070ti', name: 'NVIDIA GeForce RTX 5070 Ti 16GB', brand: 'NVIDIA', vram: 16, length: 305, tdp: 300, score: 225, price: p(84000, 779), bg: '#000000',
      blurb: 'High-refresh 1440p and entry 4K.' },
    { id: 'rtx5080',   name: 'NVIDIA GeForce RTX 5080 16GB',    brand: 'NVIDIA', vram: 16, length: 322, tdp: 360, score: 260, price: p(115000, 1099), bg: '#000000',
      blurb: 'Smooth 4K in almost everything.' },
    { id: 'rtx5090',   name: 'NVIDIA GeForce RTX 5090 32GB',    brand: 'NVIDIA', vram: 32, length: 340, tdp: 575, score: 360, price: p(260000, 2499), bg: '#000000',
      blurb: 'The fastest card there is.' },
  ],

  storage: [
    { id: 'p3plus-1tb', name: 'Crucial P3 Plus 1TB NVMe',     kind: 'm2',   size: 1000, read: 5000, price: p(6500, 69),
      blurb: 'Fast, cheap starter drive.' },
    { id: 'sn850x-2tb', name: 'WD_BLACK SN850X 2TB NVMe',     kind: 'm2',   size: 2000, read: 7300, price: p(15500, 159),
      blurb: 'Room for lots of games, very fast.' },
    { id: '990pro-2tb', name: 'Samsung 990 PRO 2TB NVMe',     kind: 'm2',   size: 2000, read: 7450, price: p(17500, 179), bg: '#ffffff',
      blurb: 'Top-tier speed and reliability.' },
    { id: 'hdd-2tb',    name: 'Seagate BarraCuda 2TB HDD',    kind: 'sata', size: 2000, read: 190,  price: p(5500, 59),
      blurb: 'Cheap space for photos and videos. Slow for games.' },
  ],

  cooler: [
    { id: 'ak400',    name: 'DeepCool AK400',                    kind: 'air', height: 155, rad: 0,   rating: 220, price: p(2500, 35), bg: '#ffffff',
      blurb: 'Quiet and cheap. Plenty for most chips.' },
    { id: 'pa120se',  name: 'Thermalright Peerless Assassin 120 SE', kind: 'air', height: 155, rad: 0, rating: 245, price: p(3500, 39), bg: '#ffffff',
      blurb: 'Twin-tower cooling for the price of one.' },
    { id: 'nh-d15g2', name: 'Noctua NH-D15 G2',                  kind: 'air', height: 168, rad: 0,   rating: 250, price: p(13000, 149),
      blurb: 'Near-silent, premium air cooling.' },
    { id: 'lf3-240',  name: 'Arctic Liquid Freezer III 240',     kind: 'aio', height: 0,   rad: 240, rating: 270, price: p(8000, 89), bg: '#ffffff',
      blurb: 'Liquid cooling that fits small cases.' },
    { id: 'lf3-360',  name: 'Arctic Liquid Freezer III 360',     kind: 'aio', height: 0,   rad: 360, rating: 320, price: p(10500, 115), bg: '#ffffff',
      blurb: 'Keeps even 16-core chips cool.' },
  ],

  psu: [
    { id: 'cx650',   name: 'Corsair CX650 650W Bronze',         watts: 650,  rating: 'Bronze', modular: 'No',   price: p(5800, 69),
      blurb: 'Enough for most budget and mid builds.' },
    { id: 'rm750e',  name: 'Corsair RM750e 750W Gold',          watts: 750,  rating: 'Gold',   modular: 'Full', price: p(8800, 99),
      blurb: 'Quiet, efficient and easy to cable.' },
    { id: 'rm850x',  name: 'Corsair RM850x 850W Gold',          watts: 850,  rating: 'Gold',   modular: 'Full', price: p(12500, 129),
      blurb: 'Headroom for high-end graphics cards.' },
    { id: 'gx1000',  name: 'Seasonic FOCUS GX-1000 1000W Gold', watts: 1000, rating: 'Gold',   modular: 'Full', price: p(16500, 179),
      blurb: 'For top-end builds with room to spare.' },
    { id: 'a1250gs', name: 'MSI MPG A1250GS 1250W Gold',        watts: 1250, rating: 'Gold',   modular: 'Full', price: p(22000, 229),
      blurb: 'Built for the RTX 5090.' },
  ],

  // Cases. size: itx | matx | mid | full | dual (two chambers, power supply hidden behind the board).
  // dims: real outer size in cm as [front-to-back, height, width].
  // fans: the fans that come in the box, as [where, how many, size in cm].
  // colors: each colour has its own official photo; the first is the default.
  case: [
    { id: 'cc560',      name: 'DeepCool CC560 V2',           size: 'mid',  dims: [41.6, 47.7, 21.0], front: 'mesh',   forms: ['ATX','mATX','ITX'], gpuMax: 370, coolerMax: 163, radMax: 360, price: p(4800, 59),
      fans: [['front', 3, 12], ['rear', 1, 12]], rgb: true,
      colors: [{ key: 'black', name: 'Black', hex: '#1b1c20', img: 'cc560', bg: '#ffffff' }],
      blurb: 'Four glowing fans in the box for very little money.' },
    { id: 'popmini',    name: 'Fractal Design Pop Mini Air', size: 'matx', dims: [40.4, 43.7, 21.5], front: 'mesh',   forms: ['mATX','ITX'], gpuMax: 335, coolerMax: 170, radMax: 280, price: p(7000, 80),
      fans: [['front', 2, 12], ['rear', 1, 12]], rgb: true,
      colors: [{ key: 'black', name: 'Black', hex: '#1c1d21', img: 'popmini-black', bg: '#e8e8e8' }, { key: 'white', name: 'White', hex: '#eef0f2', img: 'popmini-white', bg: '#e8e8e8' }],
      blurb: 'A smaller tower for mATX boards.' },
    { id: '4000d',      name: 'Corsair 4000D Airflow',       size: 'mid',  dims: [45.3, 46.6, 23.0], front: 'mesh',   forms: ['ATX','mATX','ITX'], gpuMax: 360, coolerMax: 170, radMax: 360, price: p(8500, 95),
      fans: [['front', 1, 12], ['rear', 1, 12]],
      colors: [{ key: 'black', name: 'Black', hex: '#1a1b1f', img: '4000d-black' }, { key: 'white', name: 'White', hex: '#eceef0', img: '4000d-white' }],
      blurb: 'The safe classic. Easy to build in, cool and quiet.' },
    { id: 'h5flow',     name: 'NZXT H5 Flow',                size: 'mid',  dims: [42.8, 46.4, 22.7], front: 'mesh',   forms: ['ATX','mATX','ITX'], gpuMax: 365, coolerMax: 165, radMax: 280, price: p(8000, 94),
      fans: [['front', 2, 12], ['rear', 1, 12]],
      colors: [{ key: 'white', name: 'White', hex: '#e9e9ec', img: 'h5flow' }, { key: 'black', name: 'Black', hex: '#1b1c20', img: 'h5flow-black' }],
      blurb: 'Clean, compact and easy to build in.' },
    { id: 'lancool216', name: 'Lian Li LANCOOL 216',         size: 'mid',  dims: [48.7, 49.1, 23.8], front: 'mesh',   forms: ['ATX','mATX','ITX'], gpuMax: 392, coolerMax: 180, radMax: 360, price: p(9000, 99),
      fans: [['front', 2, 16], ['rear', 1, 14]], rgb: true,
      colors: [{ key: 'black', name: 'Black', hex: '#1a1b20', img: 'lancool216', bg: '#ffffff' }],
      blurb: 'Two big 160mm fans. Fits the biggest graphics cards.' },
    { id: 'north',      name: 'Fractal Design North',        size: 'mid',  dims: [44.7, 46.9, 21.5], front: 'wood',   forms: ['ATX','mATX','ITX'], gpuMax: 355, coolerMax: 170, radMax: 360, price: p(12500, 139),
      fans: [['front', 2, 14], ['rear', 1, 12]],
      colors: [{ key: 'chalk', name: 'Chalk white', hex: '#ecebe7', img: 'north', bg: '#e8e8e8' }, { key: 'charcoal', name: 'Charcoal', hex: '#2a2a2c', img: 'north-charcoal', bg: '#e8e8e8' }],
      blurb: 'Real wood front. Looks like furniture.' },
    { id: 'o11evo',     name: 'Lian Li O11 Dynamic EVO RGB', size: 'dual', dims: [46.5, 45.9, 28.5], front: 'glass',  forms: ['ATX','mATX','ITX'], gpuMax: 426, coolerMax: 167, radMax: 360, price: p(14500, 165),
      fans: [], rgb: true,
      colors: [{ key: 'black', name: 'Black', hex: '#18191d', img: 'o11evo-black', bg: '#ffffff' }, { key: 'white', name: 'White', hex: '#eef0f3', img: 'o11evo-white', bg: '#ffffff' }],
      blurb: 'Glass on two sides to show off every part. No fans in the box.' },
    { id: 'h9flow',     name: 'NZXT H9 Flow',                size: 'dual', dims: [46.6, 49.5, 29.0], front: 'glass',  forms: ['ATX','mATX','ITX'], gpuMax: 435, coolerMax: 165, radMax: 360, price: p(15000, 160),
      fans: [['top', 3, 12], ['rear', 1, 12]],
      colors: [{ key: 'black', name: 'Black', hex: '#1a1b1f', img: 'h9flow-black' }, { key: 'white', name: 'White', hex: '#edeef1', img: 'h9flow-white' }],
      blurb: 'Big glass showcase with the cables hidden out of sight.' },
    { id: 'torrent',    name: 'Fractal Design Torrent',      size: 'full', dims: [54.4, 53.0, 24.2], front: 'grille', forms: ['ATX','mATX','ITX'], gpuMax: 461, coolerMax: 188, radMax: 360, price: p(18500, 190),
      fans: [['front', 2, 18], ['bottom', 3, 14]], rgb: true,
      colors: [{ key: 'black', name: 'Black', hex: '#1b1c1f', img: 'torrent-black', bg: '#e8e8e8' }, { key: 'white', name: 'White', hex: '#eceef0', img: 'torrent-white', bg: '#e8e8e8' }],
      blurb: 'Two huge 180mm fans. The coolest-running case here.' },
    { id: 'nr200p',     name: 'Cooler Master NR200P V2',     size: 'itx',  dims: [37.6, 29.2, 18.5], front: 'mesh',   forms: ['ITX'], gpuMax: 336, coolerMax: 155, radMax: 280, price: p(9000, 99),
      fans: [['top', 2, 12]],
      colors: [{ key: 'black', name: 'Black', hex: '#202127', img: 'nr200p' }, { key: 'white', name: 'White', hex: '#eceef0', img: 'nr200p-white' }],
      blurb: 'Shoebox-sized. Needs a mini-ITX board.' },
  ],
};
for (const list of Object.values(PARTS)) for (const x of list) x.img = img(x.id);
// Cases: each colour has its own photo; the default colour fills the card.
for (const c of PARTS.case) {
  for (const v of c.colors) v.img = img(v.img);
  Object.assign(c, { img: c.colors[0].img, bg: c.colors[0].bg, color: c.colors[0].hex, colorKey: c.colors[0].key });
  c.fanCount = c.fans.reduce((s, f) => s + f[1], 0);
}
export const CASE_SIZES = { itx: 'Mini-ITX', matx: 'Micro-ATX', mid: 'Mid tower', full: 'Full tower', dual: 'Dual chamber' };

// Games: fps at 1080p high on a GPU score of 100, and the fps a CPU with a
// gaming score of 100 can feed. cap = engine/frame limit.
export const GAMES = [
  { id: 'valorant', name: 'Valorant',               gpu: 420, cpu: 480, kind: 'Esports' },
  { id: 'cs2',      name: 'Counter-Strike 2',       gpu: 260, cpu: 330, kind: 'Esports' },
  { id: 'fortnite', name: 'Fortnite',               gpu: 125, cpu: 210, kind: 'Battle royale' },
  { id: 'warzone',  name: 'Call of Duty: Warzone',  gpu: 100, cpu: 170, kind: 'Battle royale' },
  { id: 'gta5',     name: 'GTA V Enhanced',         gpu: 120, cpu: 160, kind: 'Open world' },
  { id: 'cp2077',   name: 'Cyberpunk 2077',         gpu: 66,  cpu: 120, kind: 'Open world' },
  { id: 'rdr2',     name: 'Red Dead Redemption 2',  gpu: 70,  cpu: 140, kind: 'Open world' },
  { id: 'elden',    name: 'Elden Ring',             gpu: 85,  cpu: 120, kind: 'Action RPG', cap: 60 },
  { id: 'fh5',      name: 'Forza Horizon 5',        gpu: 105, cpu: 190, kind: 'Racing' },
  { id: 'wukong',   name: 'Black Myth: Wukong',     gpu: 52,  cpu: 130, kind: 'Action RPG' },
];

export const PRESETS = [
  { name: 'Budget gamer', note: 'Esports and older games at high fps.',
    parts: { cpu: 'i5-12400f', mobo: 'b760m-p-d4', ram: 'd4-16-3200', gpu: 'rx7600', storage: ['p3plus-1tb'], psu: 'cx650', case: 'cc560' } },
  { name: '1080p all-rounder', note: 'Every new game at 1080p, high settings.',
    parts: { cpu: 'r5-7600', mobo: 'b650-gp', ram: 'd5-32-6000', gpu: 'rx9060xt', storage: ['p3plus-1tb'], cooler: 'ak400', psu: 'rm750e', case: 'h5flow' } },
  { name: '1440p sweet spot', note: 'Fast 1440p with room to upgrade.',
    parts: { cpu: 'r7-7800x3d', mobo: 'b650-gp', ram: 'd5-32-6000', gpu: 'rx9070xt', storage: ['sn850x-2tb'], cooler: 'pa120se', psu: 'rm850x', case: 'lancool216' } },
  { name: 'Creator workstation', note: 'Rendering, editing and big code builds.',
    parts: { cpu: 'r9-9950x', mobo: 'x870e-e', ram: 'd5-64-6000', gpu: 'rtx5070ti', storage: ['990pro-2tb', 'sn850x-2tb'], cooler: 'lf3-360', psu: 'gx1000', case: 'north' } },
  { name: 'Small-form 4K', note: 'Shoebox-sized and 4K-capable.',
    parts: { cpu: 'r7-9800x3d', mobo: 'b850-i', ram: 'd5-32-6000', gpu: 'rtx5080', storage: ['990pro-2tb'], cooler: 'lf3-240', psu: 'rm850x', case: 'nr200p' } },
];
