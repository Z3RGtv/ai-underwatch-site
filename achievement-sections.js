export const sections=[
 {id:'nature',name:'Nature & woodlands',note:'Trees, plants and life on the island.',image:'nature'},
 {id:'mining',name:'Stone & minerals',note:'From the first stone to precious ores.',image:'mining'},
 {id:'building',name:'Building & colour',note:'Blocks that turn a place into a home.',image:'building'},
 {id:'tools',name:'Tools & combat',note:'The equipment to explore and survive.',image:'tools'},
 {id:'farming',name:'Food & farming',note:'Grow, gather and prepare a meal.',image:'farming'},
 {id:'engineering',name:'Redstone & transport',note:'Mechanisms, movement and invention.',image:'engineering'},
 {id:'home',name:'Life at home',note:'Workstations, furnishings and light.',image:'home'},
 {id:'dimensions',name:'Beyond the island',note:'Discoveries from the Nether and the End.',image:'dimensions'},
 {id:'treasures',name:'Treasures & curiosities',note:'Rare finds and unexpected discoveries.',image:'treasures'},
 {id:'journey',name:'The journey',note:'First steps, deeper places and milestones.',image:'journey'}
];
export const actions={collect:'Gathered',craft:'Crafted',mine:'Mined',place_item:'Placed',place:'First steps',milestone:'Milestones',depth:'Exploration'};
export function sectionFor(a){
 const k=(a.id+' '+a.title).toLowerCase().replaceAll('_',' ');
 if(['place','milestone','depth'].includes(a.type))return 'journey';
 if(/\b(?:nether|netherite|crimson|warped|soul |blaze|ghast|magma|blackstone|basalt|netherrack|ancient debris|end|ender|purpur|chorus|shulker|elytra|dragon)\b/.test(k))return 'dimensions';
 if(/\b(?:sword|pickaxe|shovel|axe|hoe|helmet|chestplate|leggings|boots|armor|armour|shield|bow|arrow|trident|mace|spear|flint and steel|shears|fishing rod)\b/.test(k))return 'tools';
 if(/\b(?:redstone|piston|observer|repeater|comparator|hopper|dispenser|dropper|rail|minecart|boat|raft|lever|button|pressure plate|tripwire|detector|daylight|target|tnt|crafter)\b/.test(k))return 'engineering';
 if(/\b(?:wheat|bread|carrot|potato|beetroot|seeds|seed|melon|pumpkin|apple|berry|berries|beef|porkchop|chicken|mutton|rabbit|cod|salmon|tropical fish|pufferfish|stew|soup|cake|cookie|sugar|egg|milk|honey|cocoa|farmland|hay block|composter|bone meal|dried kelp)\b/.test(k))return 'farming';
 if(/\b(?:bed|chest|barrel|furnace|smoker|crafting table|stonecutter|grindstone|loom|smithing|cartography|fletching|anvil|bookshelf|lectern|lantern|torch|campfire|candle|painting|pot|bell|jukebox|note block|sign|banner|carpet)\b/.test(k))return 'home';
 if(/\b(?:log|wood|planks|plank|sapling|leaves|leaf|flowers|allium|azure bluet|eyeblossom|sea pickle|flower|tulip|orchid|daisy|rose|lily|poppy|dandelion|azalea|fern|grass|vine|moss|roots|root|bamboo|cactus|kelp|seagrass|coral|mushroom|fungus|dirt|mud|podzol|mycelium|bee|resin|pale oak|propagule|spore|bush|petal)\b/.test(k))return 'nature';
 if(/\b(?:stairs|slab|walls|wall|fence|door|glass|concrete|terracotta|wool|bricks|brick|quartz|dye)\b/.test(k))return 'building';
 if(/\b(?:cobblestone|deepslate|dripstone|sandstone|stone|granite|diorite|andesite|tuff|calcite|ore|ingot|raw|coal|copper|iron|gold|diamond|emerald|lapis|amethyst|sand|gravel|clay|ice|snow|obsidian|bedrock|sponge)\b/.test(k))return 'mining';
 return 'treasures';
}
