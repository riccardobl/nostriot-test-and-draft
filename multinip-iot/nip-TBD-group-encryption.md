NIP-TBD
======

Pre-shared key encryption
---------------

`draft` `optional`

Encrypt specific parts or the entirety of an event with a pre-shared key.

## Concepts

### pre-shared secret

A private-key that is used ONLY for the encryption and decryption steps detailed in this NIP.

### Algorithm

The encryption algorithm is the same as **NIP-04**, but instead of the hash of the shared point, the [pre-shared secret](#shared-secret) is used.


### Encryption and Decryption

The encryption can be applied to the event content and/or to one or more tags.
The fields are encrypted  in place, meaning that the encrypted content replaces the original content.
If a tag is encrypted, all its values must be equally encrypted singularly.
A tag "senc" is added to the event followed by the list of tag keys that were encrypted and "content" if the content was encrypted.

eg.

unencrypted event
```
{
    ...
    content: "Hello World", // we want to encrypt this
    tags: [
        ["a", "123", "457"], // we want to encrypt this
        ["b", "789"] //  we don't want to encrypt this
    ]
}

```

encrypted event
```
{
    ...
    content: "encrypted(content)",
    tags: [
        ["a", "encrypted(123)", "encrypted(457)"],
        ["b", "789"],
        ["senc", "content", "a"]        
    ]
}
```


# NIP-04 compounding

If **NIP-04** is applied together with pre-shared key encryption, pre-shared key encryption must be applied first, then **NIP-04** encryption must be applied to the encrypted content.

- **Encryption:**   `nip_04(pre-sharedEncryption(content))`
- **Decryption:**  `pre-sharedDecryption(nip_04(content))`