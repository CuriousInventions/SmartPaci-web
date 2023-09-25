import { ControlRequest, CalibrateSensor, VersionRequest, ControlResponse, Version, CalibrateSensor_Sensor } from "./generated/bluetooth_pb";
import {toHex} from "@smithy/util-hex-encoding";

export enum InputType {
    Bite,
    Suck,
}

export enum CalibrationType {
    Min,
    Max,
}

export interface PaciVersion {
    major: number;
    minor: number;
    build: number;
    commit: string|null;
    datetime: Date|null;
    descript: string|null;
}

export interface PaciEventMap {
    'bite': CustomEvent<{value: number}>;
    'suck': CustomEvent<{values: number[]}>;
    'disconnect': Event;
    "firmwareVersion": CustomEvent<{version: PaciVersion}>;
}

// Helper interface to superimpose our custom events (and Event types) to the EventTarget
// See: https://dev.to/43081j/strongly-typed-event-emitters-using-eventtarget-in-typescript-3658
interface PaciEventTarget extends EventTarget {
    addEventListener<K extends keyof PaciEventMap>(
        type: K,
        listener: (ev: PaciEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: EventListenerOptions | boolean
    ): void;
}

// Again, see: https://dev.to/43081j/strongly-typed-event-emitters-using-eventtarget-in-typescript-3658
const typedEventTarget = EventTarget as {new(): PaciEventTarget; prototype: PaciEventTarget};

export class Paci extends typedEventTarget {
    readonly SERVICE_UUID = "abbd1ef0-62e8-493b-8549-8cb891483e20";
    readonly CHARACTERISTIC_CONTROL_UUID = "abbd1ef1-62e8-493b-8549-8cb891483e20";
    readonly CHARACTERISTIC_FORCE_UUID   = "abbd1ef2-62e8-493b-8549-8cb891483e20";
    readonly CHARACTERISTIC_BITE_UUID    = "abbd1ef3-62e8-493b-8549-8cb891483e20";

    private _device: BluetoothDevice | null;
    private _service: BluetoothRemoteGATTService | undefined;
    private _controlCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
    private _biteCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
    private _suckCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;

    private _disconnectSignal: AbortController;

    private _firmwareVersion: Promise<PaciVersion> | null;

    constructor() {
        super();

        this._device = null;
        this._firmwareVersion = null;

        this._disconnectSignal = new AbortController();
    }

    async connect(): Promise<void> {
        let params: RequestDeviceOptions = {
            filters: [
                {
                    services: [this.SERVICE_UUID],
                },
            ],
        };

        this._device = await navigator.bluetooth.requestDevice(params);
        // Assign a new abort controller only after a new device becomes our subject.
        // Abort signal used to clean up event listeners.
        this._disconnectSignal = new AbortController();

        this._device.addEventListener("gattserverdisconnected", 
            () => this.dispatchEvent(new Event("disconnected")),
            {signal: this._disconnectSignal.signal} as any);

        const server = await this._device.gatt?.connect();
        this._service = await server!.getPrimaryService(this.SERVICE_UUID);
        this._controlCharacteristic = await this._service.getCharacteristic(this.CHARACTERISTIC_CONTROL_UUID);
        this._biteCharacteristic    = await this._service.getCharacteristic(this.CHARACTERISTIC_BITE_UUID);
        this._suckCharacteristic    = await this._service.getCharacteristic(this.CHARACTERISTIC_FORCE_UUID);

        this._biteCharacteristic.addEventListener('characteristicvaluechanged', event => {
            const char = event.target as BluetoothRemoteGATTCharacteristic;
            const value = char.value?.getUint8(0) ?? 0;
            this.dispatchEvent(new CustomEvent("bite", {detail: {value}}));
        }, {signal: this._disconnectSignal.signal} as any);

        this._suckCharacteristic.addEventListener('characteristicvaluechanged', event => {
            const char = event.target as BluetoothRemoteGATTCharacteristic;
            const forces: number[] = [];
            for (let i = 0; i < char.value!.byteLength; i++) {
                forces[i] = char.value?.getUint8(i) ?? 0;
            }

            this.dispatchEvent(new CustomEvent("suck", {detail: {values: forces}}));
        }, {signal: this._disconnectSignal.signal} as any);

        this._controlCharacteristic.addEventListener('characteristicvaluechanged', event => {
            const char = event.target as BluetoothRemoteGATTCharacteristic;
            if (char.value === undefined) {
                return;
            }

            const response = ControlResponse.fromBinary(new Uint8Array(char.value.buffer));
            switch (response.response.case)
            {
                case "firmwareVersion":
                    const version = response.response.value as Version;
                    toHex(version.commit)
                    this.dispatchEvent(new CustomEvent("firmwareVersion", {
                        detail: {
                            version: {
                                major: version.major,
                                minor: version.minor,
                                build: version.build,
                                commit: toHex(version.commit),
                                descript: version.descript,
                                datetime: new Date(),
                            }
                        }
                    }));

                    break;
                default:
                    console.log(`Unsupported response (${response.response.case})`, response);
                    return;
            }
        });

        await this._biteCharacteristic.startNotifications();
        await this._suckCharacteristic.startNotifications();
        await this._controlCharacteristic.startNotifications();
    }

    async getFirmwareVersion(): Promise<string> {
        if (this._firmwareVersion === null) {
            this._firmwareVersion = this._getFirmwareVersion();
        }

        return await this._firmwareVersion.then(version => {
            let result = `${version.major}.${version.minor}.${version.build}`;
            if (version.descript != null && version.descript.length > 0) {
                result += `-${version.descript}`;
            }
            return result;
        });
    }

    async getFirmwareDate(): Promise<Date|null> {
        if (this._firmwareVersion === null) {
            this._firmwareVersion = this._getFirmwareVersion();
        }

        return await this._firmwareVersion.then(version => version.datetime);
    }

    async getFirmwareCommit(): Promise<string> {
        if (this._firmwareVersion === null) {
            this._firmwareVersion = this._getFirmwareVersion();
        }

        return await this._firmwareVersion.then(version => version.commit ?? "");
    }

    private async _getFirmwareVersion(): Promise<PaciVersion> {
        const request = new ControlRequest();

        const p = new Promise<PaciVersion>(resolve => {
            this.addEventListener("firmwareVersion" , event => resolve(event.detail.version), {once: true} as any);
        });

        request.request = {case: "firmwareVersion", value: new VersionRequest()};
        await this._controlCharacteristic!.writeValueWithResponse(request.toBinary());
        
        return await p;
    }

    async disconnect(): Promise<void> {
        // TODO: Cleanup registered event listeners
        await this._device?.gatt?.disconnect();
    }

    // addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void {

    // }

    private async _sendRequest(request: ControlRequest): Promise<void> {
        await this._controlCharacteristic!.writeValueWithResponse(request.toBinary());
    }

    async calibrateInput(input: InputType, calibrate: CalibrationType): Promise<void> {
        const calibrateMsg = new CalibrateSensor();
        switch (input) {
            case InputType.Bite:
                if (calibrate == CalibrationType.Min) {
                    calibrateMsg.sensor = CalibrateSensor_Sensor.BITE_MIN;
                } else if (calibrate == CalibrationType.Max) {
                    calibrateMsg.sensor = CalibrateSensor_Sensor.BITE_MAX;
                }
                break;
            case InputType.Suck:
                if (calibrate == CalibrationType.Min) {
                    calibrateMsg.sensor = CalibrateSensor_Sensor.SUCK_MIN;
                } else if (calibrate == CalibrationType.Max) {
                    calibrateMsg.sensor = CalibrateSensor_Sensor.SUCK_MAX;
                }
                break;
        }

        const request = new ControlRequest();
        request.request = {case: "calibrateSensor", value: calibrateMsg};

        return await this._sendRequest(request);
    }
}