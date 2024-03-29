// import {MCUManager} from "./mcumgr";
import {
    CalibrationType,
    FirmwareInfo,
    InputType,
    Paci,
    PaciFeature,
} from "./paci";
import {
    UserContent,
} from "./usercontent";

import '@popperjs/core';
import * as bootstrap from 'bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css'

import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import './style.css'
import { fromHex } from "@smithy/util-hex-encoding";

let firmwareFile: File|null = null;
let firmwareInfo: FirmwareInfo|null = null;

function onReady(_: Event)
{
    // const mgr = new MCUManager();
    const paci = new Paci();
    const usercontent = new UserContent();
    const audioContext = new AudioContext();

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
    const idBatteryLabel = document.getElementById("lblBattery")!;
    const idReconnecting = document.getElementById("reconnecting")!;
    const idEditNameButton = document.getElementById("btnEditName")!;

    const idTouchCheck0 = document.getElementById("btnTouchCheck0")! as HTMLInputElement;
    const idTouchCheck1 = document.getElementById("btnTouchCheck1")! as HTMLInputElement;
    const idTouchCheck2 = document.getElementById("btnTouchCheck2")! as HTMLInputElement;
    const idTouchCheck3 = document.getElementById("btnTouchCheck3")! as HTMLInputElement;
    const idTouchFile0 = document.getElementById("inputTouchFile0")! as HTMLInputElement;
    const idTouchFile1 = document.getElementById("inputTouchFile1")! as HTMLInputElement;
    const idTouchFile2 = document.getElementById("inputTouchFile2")! as HTMLInputElement;
    const idTouchFile3 = document.getElementById("inputTouchFile3")! as HTMLInputElement;

    const idFirmwareFile = document.getElementById("fileFirmware")! as HTMLInputElement;
    const idUploadFirmwareButton = document.getElementById("btnUploadFirmware")! as HTMLButtonElement;
    const idUploadButtonValidation = document.getElementById("btnUploadFirmwareValidation")! as HTMLElement;
    const idFirmwareValidation = document.getElementById("fileFirmwareValidation")! as HTMLElement;

    // Initialise all tooltips (this is an opt-in feature).
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
        if (paci.hasFeature(PaciFeature.Bite)) {
            idBiteProgress.closest(".card-text")?.classList.remove("d-none");
        } else {
            idBiteProgress.closest(".card-text")?.classList.add("d-none");
        }

        if (paci.hasFeature(PaciFeature.Suck)) {
            idSuckProgress.closest(".card-text")?.classList.remove("d-none");
        } else {
            idSuckProgress.closest(".card-text")?.classList.add("d-none");
        }

        // if (paci.hasFeature(PaciFeature.Touch)) {
        idTouchCheck0.closest(".card-text")?.classList.remove("d-none");
        // } else {
            // idTouchCheck0.closest(".card-text")?.classList.add("d-none");
        // }

        tryEnableUpdateButton();
    });

    paci.addEventListener("battery", event => {
        idBatteryLabel.innerText = `${event.detail.value}%`;
    });

    paci.addEventListener("bite", event => {
        idBiteProgress.style.width = ((event.detail.value / 255) * 100) + "%";
    });

    paci.addEventListener("suck", event => {
        idSuckProgress.style.width = ((event.detail.values[0] / 255) * 100) + "%";
    });

    usercontent.addEventListener("ready", _ => {
        [idTouchFile0, idTouchFile1, idTouchFile2, idTouchFile3].forEach(input => {
            const touchId = Number(input.id.at(-1));
            const span = input.closest("div")?.querySelector("label > span");
            const button = input.closest("div")?.querySelector("label > button");
            usercontent.getTouchFile(touchId)
                .then(file => {
                    if (file && span) {
                        span.innerHTML = ` - ${file.filename}`;
                        button?.classList.remove('d-none');
                    }
                });

            button?.addEventListener("click", event => {
                usercontent.removeTouchFile(touchId);
                if (span) {
                    span.innerHTML = '';
                    button?.classList.add('d-none');
                }
            });
            input.addEventListener("change", event => {
                const files = (event.target! as HTMLInputElement).files;
                if (files?.length != 1) {
                    if (span) {
                        span.innerHTML = '';
                        button?.classList.add('d-none');
                    }
                    return;
                }

                usercontent.setTouchFile(files![0], touchId);
                if (span) {
                    span.innerHTML = ` - ${files![0].name}`;
                    button?.classList.remove('d-none');
                }
            });
        });
    });

    let touched :number[] = [];
    paci.addEventListener("touch", event => {
        [idTouchCheck0, idTouchCheck1, idTouchCheck2, idTouchCheck3].forEach(input => {
            const touchId = Number(input.id.at(-1));
            input.checked = event.detail.values.includes(touchId);
            if (input.checked && !touched.includes(touchId)) {
                usercontent.getTouchFile(touchId)
                .then(file => {
                    console.log((file.blob as Uint8Array).buffer);
                    return audioContext.decodeAudioData(file.blob.buffer);
                }).then(audio => {
                    // This is the AudioNode to use when we want to play an AudioBuffer
                    const source = audioContext.createBufferSource();

                    // set the buffer in the AudioBufferSourceNode
                    source.buffer = audio;

                    // connect the AudioBufferSourceNode to the
                    // destination so we can hear the sound
                    source.connect(audioContext.destination);

                    // start the source playing
                    source.start();
                });
            }
        });
        touched = event.detail.values;
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

            const info = await paci.getFirmwareInfo(file);

            idFirmwareFile.classList.add('is-valid');
            idFirmwareValidation.classList.add('valid-feedback');
            idFirmwareValidation.classList.remove('invalid-feedback');

            idFirmwareValidation.innerHTML =
            `Version: ${info.version}<br>
            Hash: <samp>${info.hash}</samp> <i class="bi ${info.hashValid ? "bi-check-lg" : "bi-cross-lg"}"></i><br>
            Commit: <samp>${info.version.commit}</samp><br>
            Built: <et>${info.version.datetime}</et><br>
            Size: <et>${info.fileSize.toLocaleString()} bytes</et>`;

            firmwareFile = file;
            firmwareInfo = info;

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

        mcuManager.addEventListener('imageUploadFinished', async _ => {
            finished.abort();
            carousel.next();

            await mcuManager.cmdImageTest(fromHex(firmwareInfo!.hash));
            await mcuManager.cmdReset();

            paci.addEventListener('firmwareVersion', event => {
                if (event.detail.version.hash == firmwareInfo!.hash) {
                    document.getElementById("dialogUploadFail")!.classList.add("d-none");
                    document.getElementById("dialogUploadSuccess")!.classList.remove("d-none");
                } else {
                    document.getElementById("dialogUploadFail")!.classList.remove("d-none");
                    document.getElementById("dialogUploadSuccess")!.classList.add("d-none");
                }
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

    idEditNameButton.addEventListener('click', async _ => {
        const name = prompt("Set device name");
        if (name) {
            await paci.setName(name);
        }
    });
}

window.addEventListener("DOMContentLoaded", onReady);