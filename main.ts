import { useWebSocketImplementation } from 'nostr-tools/pool'
import WebSocket from 'ws'
useWebSocketImplementation(WebSocket)
global.WebSocket = WebSocket;

import {  bytesToHex } from '@noble/hashes/utils' ;
import { announceDevice, discoverDevices, Device} from './discovery';
import { generateSecretKey} from 'nostr-tools';

async function main(){
    const devicePrivateKey = bytesToHex(generateSecretKey());
    const groupSecret = bytesToHex(generateSecretKey());
    const groupId = "ROOM1-"+Math.random(); // this should be random and unique in a real scenario

    const temperatureDevice: Device = {
        name: "Temperature Sensor",
        description: "Measures the temperature of the room",
        picture: "https://something.something/temperature.png",
        actions: {
            "setPowerState": {
                name: "Power",
                description: "Turns on or off the sensor",
                picture: "https://something.something/powerbutton.png",
                inputs: {
                    power_state: {
                        name: "Power State",
                        type: "boolean",
                        description: "true = on, false = off",
                        required: true,
                        defaultValue: false
                    }
                },
                outputs: {
                    result: {
                        name: "Result",
                        type: "boolean",
                        description: "true = success, false = failure",
                        required: true
                    }
                }
            }
        },
        states: {
            "temperature": {
                name: "Temperature",
                description: "The current temperature",
                outputs: {
                    temperature: {
                        name: "Temperature",
                        type: "float",
                        description: "The current temperature in Celsius",
                        required: true
                    }
                },
                // we can specify additional filters to be used when querying the state
                filters: {
                    "#t":["temperature"]
                }
            }
        },
        // if our devices is accessible through specific relays:
        relays: ["wss://nostr.rblb.it:7777"]
    };

    console.info("Announcing device",temperatureDevice.name);
    // announce a device
    await announceDevice(
        // relays to which we want to announce our device
        ["wss://nostr.rblb.it:7777"],
        groupId,
        groupSecret,
        devicePrivateKey,
        temperatureDevice
    )

    console.info("Done... waiting...");

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.info("Discovering devices....")
    // discover all devices in the group
    const devices = await discoverDevices(["wss://nostr.rblb.it:7777"],groupId, groupSecret);
    for(const device of devices){
        console.info("Discovered device",device.name);
        console.info("  Send NIP-90 job requests to:",device.publicKey);
        console.info("        Supported actions:",JSON.stringify(device.actions,null,2));
        console.info("  Read device state by filtering by author=",device.publicKey,"and #h=",groupId, "(NIP-TBD)");
        console.info("        Supported states:",JSON.stringify(device.states,null,2));
    }

}


main();