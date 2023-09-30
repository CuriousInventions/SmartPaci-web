// import {MCUManager} from "./mcumgr";
import {CalibrationType, InputType, Paci, PaciFeature, fromSemVersion} from "./paci";
import '@popperjs/core';
import * as bootstrap from 'bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css'

import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import './style.css'
import { McuManager } from "./mcumgr";
import { toHex } from "@smithy/util-hex-encoding";

function onReady(_: Event)
{
    // const mgr = new MCUManager();
    const paci = new Paci();
    const idCalibrateSuckMinButton = document.getElementById("btnCalibrateSuckMin")!;
    const idCalibrateSuckMaxButton = document.getElementById("btnCalibrateSuckMax")!;
    const idMcuMgmtButton = document.getElementById("btnMcuMgr")!;
    const idConnectButton = document.getElementById("btnDeviceConnect")!;
    const idDisconnectButton = document.getElementById("btnDeviceDisconnect")!;
    const idBiteProgress = document.getElementById("progBite")!;
    const idSuck0Progress = document.getElementById("progSuck0")!;
    const idSuck1Progress = document.getElementById("progSuck1")!;
    const idSuck2Progress = document.getElementById("progSuck2")!;
    const idSuck3Progress = document.getElementById("progSuck3")!;
    const idVersionLabel = document.getElementById("lblVersion")!;
    const idStatusLabel = document.getElementById("lblStatus")!;
    const idNameLabel = document.getElementById("lblName")!;
    
    const idFirmwareFieldset = document.getElementById("fieldsetFirmware")! as HTMLFieldSetElement;
    const idFirmwareFile = document.getElementById("fileFirmware")! as HTMLInputElement;
    const idUploadFirmwareButton = document.getElementById("btnUploadFirmware")! as HTMLButtonElement;
    const idFirmwareValidation = document.getElementById("fileFirmwareValidation")! as HTMLElement;

    // Initalise all tooltips (this is an opt-in feature).
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    function resetUi() {
        idStatusLabel.innerText = "Disconnected";
        idDisconnectButton.style.display = "none";
        idConnectButton.style.display = "";
        idMcuMgmtButton.style.display = "none";
        idFirmwareFieldset.disabled = true;
        idUploadFirmwareButton.disabled = true;
    }

    resetUi();

    paci.addEventListener("disconnected", () => resetUi());

    paci.addEventListener("featuresUpdated", _ => {
        if (paci.hasFeature(PaciFeature.McuMgr)) {
            idMcuMgmtButton.style.display = "";
            idFirmwareFieldset.disabled = false;
        }
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
        
        idConnectButton.style.display = "none";
        idDisconnectButton.style.display = "";

        idStatusLabel.innerText = "Connected";
        let version = await paci.getFirmwareVersion();
        idVersionLabel.innerText = version;
        
        paci.getFirmwareCommit().then(commit => {
            if (commit.length > 0) {
                version += ` (${commit})`;
                idVersionLabel.innerText = version;
            }
        });

        paci.getName().then(name => idNameLabel.innerText = name);
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

    idFirmwareFile.addEventListener('change', async _ => {
        idFirmwareFile.classList.remove('is-invalid', 'is-valid');
        try {
            const file = idFirmwareFile.files?.item(0);
            if (file == null)
                return;

            if (file.size > 10_000_000)
                throw new Error("File is too large.");

            const manager = new McuManager();
            const fileData = await file.arrayBuffer();
            const info = await manager.imageInfo(fileData);
            const version = fromSemVersion(info.version);

            if (!info.hashValid)
                throw new Error(`Invalid hash: ${toHex(info.hash)}`)

            idFirmwareFile.classList.add('is-valid');
            idFirmwareValidation.classList.add('valid-feedback');
            idFirmwareValidation.classList.remove('invalid-feedback');
            idUploadFirmwareButton.disabled = false;

            idFirmwareValidation.innerHTML = 
            `Version: ${version.major}.${version.minor}.${version.revision}-${version.descript}
            <br>
            Hash: <samp>${toHex(info.hash)}</samp> <i class="bi bi-check-lg"></i>`;

            console.log(info);
        }
        catch (error) {
            idFirmwareValidation.classList.remove('valid-feedback');
            idFirmwareValidation.classList.add('invalid-feedback');
            idFirmwareFile.classList.add('is-invalid');
            idUploadFirmwareButton.disabled = true;
            if (typeof error === "string") {
                idFirmwareValidation.innerText = error;
            } else if (error instanceof Error) {
                idFirmwareValidation.innerText = error.message;
                console.error(error);
            }
        }
    });

    idUploadFirmwareButton.addEventListener('click', _ => {

    });

}

window.addEventListener("DOMContentLoaded", onReady);