// import {MCUManager} from "./mcumgr";
import {CalibrationType, InputType, Paci, PaciFeature} from "./paci";
import '@popperjs/core';
import * as bootstrap from 'bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css'

import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import './style.css'
import { McuImageInfo, McuManager } from "./mcumgr";
import { toHex } from "@smithy/util-hex-encoding";

let firmwareFile: File|null = null;
let firmwareInfo: McuImageInfo|null = null;

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
    const idSuckProgress = document.getElementById("progSuck")!;
    const idVersionLabel = document.getElementById("lblVersion")!;
    const idCommitLabel = document.getElementById("lblCommit")!;
    const idBuildDateLabel = document.getElementById("lblBuildDate")!;
    const idStatusLabel = document.getElementById("lblStatus")!;
    const idNameLabel = document.getElementById("lblName")!;
    const idReconnecting = document.getElementById("reconnecting")!;
    
    const idFirmwareFile = document.getElementById("fileFirmware")! as HTMLInputElement;
    const idUploadFirmwareButton = document.getElementById("btnUploadFirmware")! as HTMLButtonElement;
    const idUploadButtonValidation = document.getElementById("btnUploadFirmwareValidation")! as HTMLElement;
    const idFirmwareValidation = document.getElementById("fileFirmwareValidation")! as HTMLElement;

    // Initalise all tooltips (this is an opt-in feature).
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    function resetUi() {
        idStatusLabel.innerText = "Disconnected";
        idDisconnectButton.classList.add("d-none");
        idConnectButton.classList.remove("d-none");
        idMcuMgmtButton.classList.add("d-none");
        idUploadFirmwareButton.disabled = true;
        idReconnecting.classList.add("d-none");
    }

    function tryEnableUpdateButton(): void {
        // Only enable the update button if the paci is connected and supports updating.
        if (!paci.connected) {
            idUploadFirmwareButton.disabled = true;
            idUploadFirmwareButton.classList.add("is-invalid");
            idUploadButtonValidation.innerText="Device is not connected.";
        } else if (!paci.hasFeature(PaciFeature.McuMgr)) {
            idUploadFirmwareButton.disabled = true;
            idUploadFirmwareButton.classList.add("is-invalid");
            idUploadButtonValidation.innerText="This device does not support firmware updates.";
        } else {
            // Good to go!
            idUploadFirmwareButton.classList.remove("is-invalid");
            idUploadFirmwareButton.disabled = !(firmwareInfo?.hashValid ?? false);
        }
    }

    resetUi();

    paci.addEventListener("disconnected", () => resetUi());

    paci.addEventListener("featuresUpdated", _ => {
        if (paci.hasFeature(PaciFeature.McuMgr)) {
            idMcuMgmtButton.style.display = "";
        }

        tryEnableUpdateButton();
    });

    paci.addEventListener("bite", event => {
        idBiteProgress.style.width = ((event.detail.value / 255) * 100) + "%";
    });

    paci.addEventListener("suck", event => {
        idSuckProgress.style.width = ((event.detail.values[0] / 255) * 100) + "%";
    });
    paci.addEventListener("touch", event => {
        console.log("Touched pads:", event.detail.values);
    });

    // Connect to the paci!
    idConnectButton.addEventListener('click', async _ => {
        await paci.connect();
    });

    paci.addEventListener('reconnecting', async _ => {
        idReconnecting.classList.remove("d-none");
    });

    paci.addEventListener('connected', async _ => {
        idReconnecting.classList.add("d-none");
        idConnectButton.classList.add("d-none");
        idDisconnectButton.classList.remove("d-none");

        idStatusLabel.innerText = "Connected";
        paci.getFirmwareVersion().then(version => idVersionLabel.innerText = version);
        paci.getFirmwareCommit().then(commit =>  idCommitLabel.innerText = (commit.length > 0) ? commit : "");
        paci.getFirmwareDate().then(date => idBuildDateLabel.innerText = (date != null && !isNaN(date.valueOf())) ? `${date.toDateString()} ${date.toLocaleTimeString()}` : "");
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

            const firmwareInfo = await paci.getFirmwareInfo(file);

            idFirmwareFile.classList.add('is-valid');
            idFirmwareValidation.classList.add('valid-feedback');
            idFirmwareValidation.classList.remove('invalid-feedback');

            idFirmwareValidation.innerHTML = 
            `Version: ${firmwareInfo.version}<br>
            Hash: <samp>${firmwareInfo.hash}</samp> <i class="bi bi-check-lg"></i><br>
            Commit: <samp>${firmwareInfo.version.commit}</samp><br>
            Built: <et>${firmwareInfo.version.datetime}</et><br>
            Size: <et>${firmwareInfo.fileSize.toLocaleString()} bytes</et>`;

            firmwareFile = file;

            tryEnableUpdateButton();
        }
        catch (error) {
            idFirmwareValidation.classList.remove('valid-feedback');
            idFirmwareValidation.classList.add('invalid-feedback');
            idFirmwareFile.classList.add('is-invalid');

            if (typeof error === "string") {
                idFirmwareValidation.innerText = error;
            } else if (error instanceof Error) {
                idFirmwareValidation.innerText = error.message;
                console.error(error);
            }
        }
    });

    idUploadFirmwareButton.addEventListener('click', event => {
        const finished = new AbortController();
        const button = event.target as HTMLButtonElement;

        const uploadModal = document.getElementById("firmwareUploadModal")!;
        const proceedButton = document.getElementById("firmwareUploadProceedButton") as HTMLButtonElement;
        const uploadProgress = document.getElementById("uploadProgress")!;
        const modelFooter = uploadModal.getElementsByClassName("modal-footer")[0];

        const uploadModalInstance = new bootstrap.Modal(uploadModal, {backdrop: 'static', keyboard: false});

        const mcuManager = paci.mcuManager;
        const carousel = new bootstrap.Carousel(
            uploadModal.getElementsByClassName("carousel")[0], 
            {
                touch: false, 
                keyboard: false,
            });

        // Reset the the modal's carousel to the first item
        carousel.to(0);
        carousel.pause();

        
        // modelFooter is collaspable and may be hidden.
        modelFooter.classList.add('show');
        uploadModalInstance.show(button);
        
        mcuManager.addEventListener('imageUploadProgress', event => {
            const progress = (event.detail.percentage) + "%";
            uploadProgress.innerText = uploadProgress.style.width = progress;
        }, {signal: finished.signal});

        mcuManager.addEventListener('imageUploadFinished', _ => {
            finished.abort();
            carousel.next();
            mcuManager.cmdReset();

            paci.addEventListener('connected', async _ => {
                carousel.next();
            }, {once: true});
        }, {once: true})

        uploadModal.addEventListener('hidden.bs.modal', _ => {
            finished.abort();
        });

        proceedButton.addEventListener('click', async _ => {
            // new bootstrap.Collapse(modelFooter).hide();
            carousel.next();

            // Try to prevent navigation away from the page.
            addEventListener('beforeunload', event => {
                event.preventDefault();
                return (event.returnValue = "");
            }, {signal: finished.signal});

            await mcuManager.cmdUpload(await firmwareFile!.arrayBuffer());
        });
    });

}

window.addEventListener("DOMContentLoaded", onReady);