import {MCUManager} from "./mcumgr";

function onReady(event: Event)
{
    let mgr = new MCUManager();
    mgr.connect([{name:"Booper"}]);
    console.log("Ready!", event);
}

window.addEventListener("DOMContentLoaded", onReady);