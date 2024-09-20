# Device discoverability

Devices periodically send a group encrypted kind 1 event tagged with h:groupId.

Structure:

(TODO)
```
{
    kind: 1,
    content: JSON.stringify({
        // device specs
        // see ./discovery.ts for definition
    }),
    tags: [
        ["h", groupId],
        ["client", "nostriot"]
    ]
}

```

other devices and apps can discover devices by subscribing to `{kinds:[1], #h:[groupId]}` nb. events that fail the decryption should be discarded as invalid.
When a device is discovered, its public key should be stored locally for future communication using nip-90 job requests, or to fetch its status using (?)(TBD).




# Group Encryption

In *nostriot*, events can be encrypted for a group of users and devices using the same algorithm as **NIP-04**, but with a pre-shared private key, referred to as the *group secret*.

When encrypting *nostriot* events for a group, the `content` field is encrypted using the group secret, and a `nostriot/encrypted` tag is added to the event.

If **NIP-04** is applied together with group encryption, encryption and decryption must be handled as follows:

- **Encryption:**   `nip04(nostriot_encrypt(content))`

- **Decryption:**  `nostriot_decrypt(nip04(content))`

Job results and feedbacks should use group encryption only if the request itself was group encrypted.

Device statuses should always use group encryption unless the device is set to be public.