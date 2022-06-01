//import * as URLS from "./test-urls-private.js";
import {saveFile} from "./util-node.js";
import {Nodes} from "../src/mega.js";
import {progress} from "./progress.js";

async function example() {
    
    const folderNodes = await Nodes.nodes("https://mega.nz/folder/2t1yTLhZ#_FttzCVkgnOY_-8znSTegg");
    const promises = [];
    let i = 0;
    let j = 0;
    
    for (const node of folderNodes) {
        
        if (Nodes.isMediaNode(node)) {
            const index = ++i; // a block closure
            console.log(`${index} ${node.name}`);
            const handled = node.getThumbnail()
                .then(thumb => {
                    console.log(thumb)
                    /*saveFile(thumb,
                        `thumbnail-${index.toString().padStart(3, "0")}-${node.id}.jpg`,
                        //`${node.name}.jpg`, // or
                        node.mtime,
                        // node.path
                    );*/
                });
            promises.push(handled);

           break;
        }
    }
    return Promise.all(promises);
}


!async function main() {
    console.time("Time");
    await example();
    console.timeEnd("Time");
}();
