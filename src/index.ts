import {MCUManager} from "./mcumgr";
import {Paci} from "./paci";
import 'bootstrap';

import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import './style.css'


function onReady(event: Event)
{
    // const mgr = new MCUManager();
    const paci = new Paci();
    const idConnectButton = document.getElementById("btnDeviceConnect")!;
    const idDisconnectButton = document.getElementById("btnDeviceDisconnect")!;
    const idBiteProgress = document.getElementById("progBite")!;
    const idSuck0Progress = document.getElementById("progSuck0")!;
    const idSuck1Progress = document.getElementById("progSuck1")!;
    const idSuck2Progress = document.getElementById("progSuck2")!;
    const idSuck3Progress = document.getElementById("progSuck3")!;

    paci.onBiteReceived(value => {
        idBiteProgress.style.width = ((value / 255) * 100) + "%";
    });
    paci.onSuckReceived(values => {
        idSuck0Progress.style.width = ((values[0] / 255) * 100) + "%";
        idSuck1Progress.style.width = ((values[1] / 255) * 100) + "%";
        idSuck2Progress.style.width = ((values[2] / 255) * 100) + "%";
        idSuck3Progress.style.width = ((values[3] / 255) * 100) + "%";
    });

    idConnectButton.addEventListener('click', async event => {
        await paci.connect();
    });

    idDisconnectButton.addEventListener('click', async event => {
        await paci.disconnect();
    });
    
    console.log("Ready!", event);
}

window.addEventListener("DOMContentLoaded", onReady);