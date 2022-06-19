
export class Paci {
    readonly SERVICE_UUID                = "abbd1ef0-62e8-493b-8549-8cb891483e20";
    readonly CHARACTERISTIC_CONTROL_UUID = "abbd1ef1-62e8-493b-8549-8cb891483e20";
    readonly CHARACTERISTIC_FORCE_UUID   = "abbd1ef2-62e8-493b-8549-8cb891483e20";
    readonly CHARACTERISTIC_BITE_UUID    = "abbd1ef3-62e8-493b-8549-8cb891483e20";
    
    private _device: BluetoothDevice | null;
    private _service: BluetoothRemoteGATTService | undefined;
    private _biteCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
    private _suckCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
    private _onBiteReceived: ((this: this, value: number) => any) | undefined;
    private _onSuckReceived: ((this: this, values: number[]) => any) | undefined;

    constructor(){
        this._device = null;
    }

    async connect(): Promise<void> {
        let params : RequestDeviceOptions = {
            filters: [
                {
                    services: [this.SERVICE_UUID],
                },
            ],
        };

        this._device = await navigator.bluetooth.requestDevice(params);
        const server = await this._device.gatt?.connect();
        this._service = await server!.getPrimaryService(this.SERVICE_UUID);
        this._biteCharacteristic = await this._service.getCharacteristic(this.CHARACTERISTIC_BITE_UUID);
        this._suckCharacteristic = await this._service.getCharacteristic(this.CHARACTERISTIC_FORCE_UUID);

        this._biteCharacteristic.addEventListener('characteristicvaluechanged', async event => {
            const char = event.target as BluetoothRemoteGATTCharacteristic;
            const value = char.value?.getUint8(0) ?? 0;
            if (this._onBiteReceived)
                await this._onBiteReceived(value);
        });

        this._suckCharacteristic.addEventListener('characteristicvaluechanged', async event => {
            const char = event.target as BluetoothRemoteGATTCharacteristic;
            const forces :number[] = [];
            for(let i = 0; i < char.value!.byteLength; i++)
            {
                forces[i] = char.value?.getUint8(i) ?? 0;
            }
            if (this._onSuckReceived)
                await this._onSuckReceived(forces);
        });

        this._biteCharacteristic.startNotifications();
        this._suckCharacteristic.startNotifications();
    }

    async disconnect(): Promise<void> {
        // TODO: Cleanup registered event listeners
        await this._device?.gatt?.disconnect();
    }

    onBiteReceived(listener: (this: this, value: number) => any): void {
        this._onBiteReceived = listener;
    }

    onSuckReceived(listener: (this: this, values: number[]) => any): void {
        this._onSuckReceived = listener;
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void {

    }
}