import { useWebSocketImplementation } from 'nostr-tools/pool'
import WebSocket from 'ws'
useWebSocketImplementation(WebSocket)


import {  hexToBytes } from '@noble/hashes/utils' ;
import crypto from 'crypto';

import { finalizeEvent, generateSecretKey, getPublicKey, nip04, VerifiedEvent, SimplePool, verifyEvent } from 'nostr-tools';

export type InputOutputTypes = string | number | boolean | Array<string> | Array<number> | Array<boolean>;
export type InputOutputTypeDescriptor = 'string' | 'int' | 'float' | 'boolean' | 'string[]' | 'int[]' | 'float[]' | 'boolean[]' ;
export type ActionInputOutput = {
    name: string,
    description: string,
    type: InputOutputTypeDescriptor,
    choices?: { 
        options: [
            {
                id: string,
                name: string,
                description:string, 
                value: InputOutputTypes
            }
        ]
        selected: InputOutputTypes,
        maxSelections: number
    },
    required: boolean,
    defaultValue?: InputOutputTypes
};

export type DeviceAction = {
    name: string,
    picture: string,
    description: string,
    inputs: { [key: string]: ActionInputOutput },
    outputs: { [key: string]: ActionInputOutput }
}



export type DeviceState = {
    name: string,
    description: string,
    outputs: { [key: string]: ActionInputOutput },
    filters?: { [key: string]: Array<String> }
}

export type Device = {
    name: string,
    picture: string,
    description: string
    actions: { [key: string]: DeviceAction },
    states: { [key: string]: DeviceState }
    relays?: Array<string>
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
        ]
    }
    // encrypt content
    const iv = crypto.randomFillSync(new Uint8Array(16));
    const ivBase64 = Buffer.from(iv.buffer).toString('base64')
    // derive 32 bytes key from group secret
    const secretKey = crypto.createHash('sha256').update(groupSecret).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
    event.content = cipher.update(event.content, 'utf8', 'base64') + cipher.final('base64')    
    event.tags.push(["encrypted", "aes-256-cbc", ivBase64]);

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
            onevent: (event) => {
                try {
                    if(!verifyEvent(event)) throw new Error("Invalid event (bad signature)");
                    const encryptedTag = event.tags.find(([k, v]) => k === "encrypted");
                    if (!encryptedTag) throw new Error("Invalid event (missing encrypted tag)");
                    const [_, algorithm, ivB64] = encryptedTag;
                    if (algorithm !== "aes-256-cbc") throw new Error("Invalid event (unsupported encryption algorithm)");
                    if (!ivB64) throw new Error("Invalid event (missing IV)");
                    const iv = Buffer.from(ivB64, 'base64');
                    const encryptedContentB64 = event.content;
                    // derive 32 bytes key from group secret
                    const secretKey = crypto.createHash('sha256').update(groupSecret).digest();
                    const decipher = crypto.createDecipheriv('aes-256-cbc',secretKey, iv);
                    const content = decipher.update(encryptedContentB64, 'base64', 'utf8') + decipher.final('utf8');                    
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