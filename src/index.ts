// import {MCUManager} from "./mcumgr";
import {CalibrationType, InputType, Paci} from "./paci";
import 'bootstrap';

import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import './style.css'


function onReady(_: Event)
{
    // const mgr = new MCUManager();
    const paci = new Paci();
    const idCalibrateSuckMinButton = document.getElementById("btnCalibrateSuckMin")!;
    const idCalibrateSuckMaxButton = document.getElementById("btnCalibrateSuckMax")!;
    const idConnectButton = document.getElementById("btnDeviceConnect")!;
    const idDisconnectButton = document.getElementById("btnDeviceDisconnect")!;
    const idBiteProgress = document.getElementById("progBite")!;
    const idSuck0Progress = document.getElementById("progSuck0")!;
    const idSuck1Progress = document.getElementById("progSuck1")!;
    const idSuck2Progress = document.getElementById("progSuck2")!;
    const idSuck3Progress = document.getElementById("progSuck3")!;
    const idVersionLabel = document.getElementById("lblVersion")!;
    const idStatusLabel = document.getElementById("lblStatus")!;

    idStatusLabel.innerText = "Disconnected";

    paci.addEventListener("disconnected", () => {
        idStatusLabel.innerText = "Disconnected";
    });

    paci.addEventListener("bite", event => {
        idBiteProgress.style.width = ((event.detail.value / 255) * 100) + "%";
    });
    paci.addEventListener("suck", event => {
        idSuck0Progress.style.width = ((event.detail.values[0] / 255) * 100) + "%";
        idSuck1Progress.style.width = ((event.detail.values[1] / 255) * 100) + "%";
        idSuck2Progress.style.width = ((event.detail.values[2] / 255) * 100) + "%";
        idSuck3Progress.style.width = ((event.detail.values[3] / 255) * 100) + "%";
    });

    idConnectButton.addEventListener('click', async _ => {
        await paci.connect();
        idStatusLabel.innerText = "Connected";
        let version = await paci.getFirmwareVersion();
        idVersionLabel.innerText = version;
        
        await paci.getFirmwareCommit().then(commit => {
            if (commit.length > 0) {
                version += ` (${commit})`;
                idVersionLabel.innerText = version;
            }
        });
    });

    idDisconnectButton.addEventListener('click', async _ => {
        await paci.disconnect();
    });
    
    idCalibrateSuckMinButton.addEventListener('click', async _ => {
        await paci.calibrateInput(InputType.Suck, CalibrationType.Min);
    });
    
    idCalibrateSuckMaxButton.addEventListener('click', async _ => {
        await paci.calibrateInput(InputType.Suck, CalibrationType.Max);
    });

}

window.addEventListener("DOMContentLoaded", onReady);