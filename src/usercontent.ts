export class UserContent extends EventTarget{
    readonly DB_NAME = "curioustoys-smartpaci-usercontent";
    readonly DB_VERSION = 1;
    readonly DB_CONTENT_STORENAME = "content";

    private _request: IDBOpenDBRequest;

    constructor() {
        super();
        this._request = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

        this._request.onsuccess = this._onSuccess.bind(this);
        this._request.onerror = this._onError.bind(this);
        this._request.onupgradeneeded = this._onUpgradeNeeded.bind(this);
    }

    private get request() :IDBOpenDBRequest {
        if (this._request?.readyState == "done") {
            return this._request;
        }

        throw Error("Could not open IndexedDB");
    }

    private _onError(event: Event) {
        console.error(event);
    }

    private _onSuccess(event: Event) {
        this.dispatchEvent(new Event("ready"));

    }

    private _onUpgradeNeeded(event: IDBVersionChangeEvent) {
        const db = (event.target as IDBRequest).result;

        const contentStore = db.createObjectStore(this.DB_CONTENT_STORENAME, {keyPath: "id", autoIncrement: true});
        contentStore.createIndex("filename", "filename", {unique: true});
        contentStore.createIndex("touchid", "touchid", {unique: true});
    }

    setTouchFile(file: File, touchId: number) {
        const db = this.request.result;

        file.arrayBuffer().then(buffer => {
            const data = new Uint8Array(buffer);
            const transaction = db.transaction(this.DB_CONTENT_STORENAME, "readwrite");
            const store = transaction.objectStore(this.DB_CONTENT_STORENAME);

            let obj = {
                filename: file.name,
                touchid: touchId,
                blob: data,
            };

            store.add(obj);
        });
    }

    getTouchFile(touchId: number) :Promise<any> {
        const db = this.request.result;
        const transaction = db.transaction(this.DB_CONTENT_STORENAME, "readonly");
        const store = transaction.objectStore(this.DB_CONTENT_STORENAME);

        const obj = store.index("touchid").get(touchId);

        return new Promise((resolve) => {
            obj.addEventListener('success', event => {
                resolve((event.target as IDBRequest)!.result);
            }, {once: true});
        });
    }
}