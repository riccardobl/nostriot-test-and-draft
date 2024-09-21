import { useWebSocketImplementation } from 'nostr-tools/pool'
import WebSocket from 'ws'
useWebSocketImplementation(WebSocket)


import {  hexToBytes } from '@noble/hashes/utils' ;
import { groupEncrypt,groupDecrypt } from './utils';
import { finalizeEvent, VerifiedEvent, SimplePool, verifyEvent } from 'nostr-tools';

export type InputOutputTypes = string | number | boolean | Array<string> | Array<number> | Array<boolean>;
export type InputOutputTypeDescriptor = 'string' | 'int' | 'float' | 'boolean' | 'string[]' | 'int[]' | 'float[]' | 'boolean[]' ;
export type ActionInputOutput = {
    name?: string,
    description?: string,
    type: InputOutputTypeDescriptor,
    choices?: { 
        options: {
            [key: string]: InputOutputTypes
        }
        maxSelections: number
    },
    required: boolean,
    defaultValue?: InputOutputTypes
};

export type DeviceAction = {
    name?: string,
    picture?: string,
    description?: string,
    inputs: { [key: string]: ActionInputOutput },
    outputs: { [key: string]: ActionInputOutput },
    tags?: Array<Array<string>>
}

export type DeviceState = {
    name?: string,
    picture?: string,
    description?: string,
    outputs: { [key: string]: ActionInputOutput },
    filters?: { [key: string]: Array<String> },
    tags?: Array<Array<string>>
}

export type Device = {
    name: string,
    picture?: string,
    description?: string
    actions: { [key: string]: DeviceAction },
    states: { [key: string]: DeviceState }
    relays?: Array<string>
    tags?: Array<Array<string>>
}

export type DiscoveredDevice = {
    publicKey: string,
} & Device;

export async function announceDevice (
    relays: Array<string>,
    groupId: string,
    groupSecret:string,
    devicePrivateKey: string,
    device: Device,
) {
    const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: JSON.stringify(device),
        tags: [
            ["h", groupId],
            ["client", "nostriot"]
        ]
    }

    event.content = await groupEncrypt(groupSecret, event.content);
    event.tags.push(["nostriot/encrypted"]);

    // sign event
    const verifiedEvent:VerifiedEvent =  finalizeEvent(event, hexToBytes(devicePrivateKey));    

    const pool = new SimplePool();
    await Promise.allSettled(pool.publish(relays, verifiedEvent));

}


export async function discoverDevices(
    relays: Array<string>,
    groupId: string,
    groupSecret: string,
    since?: number
): Promise<Array<DiscoveredDevice>> {
    if (!since) {
        // last 24 hours
        since = Math.floor(Date.now() / 1000) - 24 * 3600;
    }
    const pool = new SimplePool();
    const devices: Array<DiscoveredDevice> = await new Promise((resolve, reject) => {
        const devices = Array<DiscoveredDevice>();
        const sub = pool.subscribeMany(relays, [{
            kinds: [1],
            "#h": [groupId],
            "since": since
        }], {
            onevent: async (event) => {
                try {
                    if(!verifyEvent(event)) throw new Error("Invalid event (bad signature)");
                    const nostriotEncryptTag = event.tags.find(([k, v]) => k === "nostriot/encrypted");
                    let content = event.content;
                    if (nostriotEncryptTag) {
                        content = await groupDecrypt(groupSecret, content);
                    }              
                    const device:Device = JSON.parse(content);
                    const discoveredDevice:DiscoveredDevice = {
                        publicKey: event.pubkey,
                        ...device
                    };
                    devices.push(discoveredDevice);
                } catch (e) {
                    console.error(e);
                }
            },
            oneose: () => {
                sub.close();
                resolve(devices);
            },
            onclose: (e) => {
                sub.close();
                console.info(e);
                resolve(devices);
            }
        });
    });

    return devices;
}