//global.window = {}; // Target for things like window.onpopstate in Nav.js
const stream = require('readable-stream');
global.DwebTransports = require('dweb-transports/index.js'); //TODO-MIRROR move to repo
global.DwebObjects = require('dweb-objects/index.js'); //Includes initializing support for names //TODO-MIRROR move to repo
const HashStore = require('./HashStore.js');
const MirrorCollection = require('./MirrorCollection.js');
const MirrorFS = require('./MirrorFS.js');
const s = require('./StreamTools.js');
const ArchiveItem = require('dweb-archive/ArchiveItem');  //TODO-MIRROR move to repo
const wrtc = require('wrtc');
var config = {
    hashstore: { file: "level_db" },
    ui: {},
    fs: {},
    directory: "/Users/mitra/temp/mirrored",
};

//emitter.setMaxListeners(15); - for error message to fix this  but not sure what "emitter" is


class Mirror {

    static async init() {
        await HashStore.init(config.hashstore);
    }
    static async test() {
        await HashStore.test();
    }
    static async p_dev_mirror() {
        try {
            global.verbose = true;
            // Incremental development building and testing components to path in README.md
            await DwebTransports.p_connect({
                    transports: ["HTTP", "WEBTORRENT"],
                    webtorrent: {tracker: { wrtc }},
                }, verbose);
            //TODO-MIRROR this is working around default that HTTP doesnt support streams, till sure can use same interface with http & WT
            DwebTransports.http(verbose).supportFunctions.push("createReadStream");
            let itemid = "prelinger";
            // Total number of results will be ~ maxpages * limit
            let limit = 3;
            let maxpages = 3 ;
            new MirrorCollection({itemid})          // Initialize collection
                // Collection ready to search
                .s_searchitems({limit, maxpages})   // Repeatedly fetch new pages for the collection
                // a stream of Search results (minimal JSON) ready for fetching
                //.pipe(new s().slice(0,1))   //Restrict to first Archive Item
                .pipe(new s().log((m)=>["SearchResult:", m.identifier]))
                //.pipe(new MirrorItemFromStream({highWaterMark: 3}))
                //.pipe(new MirrorMapStream((o) => new ArchiveItem({itemid: o.identifier}).fetch().then(o=>o._list)))
                .pipe(new s({parallel: 5}).map((o) => new ArchiveItem({itemid: o.identifier}).fetch().then(o=>o._list))) // Parallel metadata reads
                // a stream of arrays of ArchiveFiles
                .pipe(new s().split())
                // a stream of ArchiveFiles's with metadata fetched
                .pipe(new s().filter(af => af.metadata.size < 1000000))
                .pipe(new s().slice(0,200))   //TODO-MIRROR remove this debugging - limits to first ArchiveItem found
                .pipe(new s().log((m)=>["FileResult:", `${m.itemid}/${m.metadata.name}`]))
                .pipe(new MirrorFS({directory: config.directory, parallel: 5 }))    // Parallel retrieve to file system
                .pipe(new s().log((o)=>["MirrorFS Result:", `${o.archivefile.itemid}/${o.archivefile.metadata.name} size=${o.size} expect size=${o.archivefile.metadata.size}`]))

        } catch(err) {
            console.error(err);
        }
    }
}


Mirror.init()
    //.then(() => Mirror.test())
    .then(() => Mirror.p_dev_mirror())
    .then(() => console.log("tested waiting for output"));
