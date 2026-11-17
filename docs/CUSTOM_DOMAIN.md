# smartpayroll.com — pending ownership verification

The custom hostname has been prepared for the published SmartPayroll site. This does not register or purchase the domain. The domain owner must configure its DNS. The existing URL continues to work until the custom hostname is active:

https://smartpayroll-badariah.greyapex8.chatgpt.site

Configure the following records at the domain's DNS provider:

| Type | Name                      | Value                                                                |
| ---- | ------------------------- | -------------------------------------------------------------------- |
| A    | @                         | 162.159.143.30                                                       |
| A    | @                         | 172.66.3.26                                                          |
| TXT  | _openai-site-verification | openai-site-verification=FvQCz3phXMaFDh2deV7NYL-Csw3pMWJhO2i37ofjhrw |
| TXT  | _cf-custom-hostname       | e04244c6-d2cb-4e33-9017-7d0cc2746538                                 |

Some DNS providers require the full hostname instead of the short Name: `_openai-site-verification.smartpayroll.com` and `_cf-custom-hostname.smartpayroll.com`. The two A records are both for `smartpayroll.com`. Use DNS-only mode if your provider offers a proxy toggle.

The hostname status and HTTPS certificate must become active before calling the domain connected. No claim has been made about domain availability or ownership. No DNS records have been changed by this setup.

Install the PWA from the final domain once it is active. Guest cookies are specific to a browser and hostname; switching domains does not automatically transfer a guest workspace. Signed-in owner access identifies the same Site account and retains server-side data.
