# Vercel Environment Variables Setup

## Required Environment Variables

Add these environment variables in your Vercel dashboard:

### 1. Go to Vercel Dashboard
1. Visit https://vercel.com/dashboard
2. Select your KDStudio project
3. Go to **Settings** → **Environment Variables**

### 2. Add Environment Variables

Add the following variables:

#### Email Configuration
```
EMAIL_USER = hello@aimandaniel.my
EMAIL_PASSWORD = heke yori ziqp mudj
```

#### Firebase Admin SDK
```
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@kdstudio-d9676.iam.gserviceaccount.com
```

#### Firebase Private Key
```
FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDNCLsIu4nADrca
CyA/7XkaeojNoYSfj/bECGpjOMggrskxAd/R/FV968YZVcyGC2xf02rgQSa/ym/T
f/tMvOrc1DklML/nseIGXCML6p28tIJK+mm+GIe3/oQ0zLLo+9TcQEKqHKhTcLFs
LmTBaZqLpPbvZ+6GAgYC+6d22cq5TcVti3ixchTH27oGbEJYwe647JgflpnUBcTB
6G4WhM0J+2joDvTtjpMwCf6W+ruuQqgyV0XhoKVMoBNwUJ5zw+von0ufBnJQcLEp
d7/M7F9FRVN2mIwddW6BdmSR1tdlHLi2o3zL8wZPAU+xkWzTY8sx94M+Lp8cG5fk
fGvvFESpAgMBAAECggEAAMsHWi3LhxwndijT25tyC/msXMtCpZFbfX+g1bhrAcFb
Ut60fG3y8LVAQ2nTDDOwHCDHuY1W9of0bceBc9cJO4hwniW1oFJOUwL5ObsTGB9E
n8CfNxaGM95+qWufR4pt1NpEx76rogL+FLKLPjpH2EFvmRZ4VDlex5UsnSeTgqr6
Ebs11VaY1irCPIsotVga8x5ATCUvzlJ9j4rgJjmSBsmmoUXyz6xza3GJjwwPCEBt
gbylbac9djGGDX7vJlhg4MgwBcCNqPoEWoh5n9ZHK2+1YRMnP7K7H0N3q+6ezQSG
JpwgszHVtQJOppc0vSiVz4VzhMMJnNnuj71qw5Od9wKBgQDwwKwpcSBqfRE+hkQd
5GvFE2t7b5E2N/oWJH9Ln+lWwFIp4mNvh6+zwew6JrReVKwJvE29K9ehbqvUP60R
s7qIYWWvf0PkwJT3OHdSZzs0zqRapziOfuvpUR8XzeVeHJtfA66hvRgGohs01i+X
2312F8NBbV2opQudEQVPFgbRqwKBgQDaBPPyS39v9VyBQSVdAOVELqSK3fxZgHri
lukxgoDzp2YsapO0O7JYNx9HoqY4rnUIVI6rP3YXHxrgv4wtCTkhuabfVznOKa71
eQBEsAP3wPoGqXjpES1MpGJ5TP1bWlrOM+//l6gZlahXjUM0CDwzq1wbOckCshgl
klnSoSAW+wKBgDTdqjBjdgHMOtgm9Zg2y294JzbwtctZGWJ5WzaJA90X2DL4Umtw
OSXY5H2UeDDqmOh+X/e1Q+FgAv1VijSD6eb+tCyIXqlBnLR4wsLmhjq/UZnSdHnd
5wHR3WkFvmMfFwMTNOqxMjBqsly017iZ6v/ekfKxCEr7CwTPcwH9zTuHAoGAAXof
HPkd9+g1pDqIwkSLSRb3zmkKmKCiNH7JPaigrwXnT025inMNFkPpVlbnwWKNMG1C
Oi7H4gg36mXh0TxKwsu7MbApmBf4M3mKYuy+WiNYjkr/orSXFfnXIPNAlCnci6EW
cyjX3rSA23b9iZC0t7Tlftm5XudN+pMvQJoO2ZkCgYAHR6iAq1b4jJ7n9sS1lvki
MA+XsK0CbGmUcA92MgtSE9hfnR53YOESBcNM7tYD6hS/6/6BuXCVrKNMNlmG9auA
5TQqvZqQ3eeZLGHN1CXHIsgn1aDwPiN0qbDhJxzz4NMWlKxamUoZK3b+iWmoFhuI
MS1S94Eu1miNyFcWjLqFfg==
-----END PRIVATE KEY-----"
```

#### FCM Sender ID
```
FCM_SENDER_ID = 1079743577825
```

### 3. Important Notes

1. **Private Key Formatting**: Make sure to include the quotes around the private key value
2. **Environment Scope**: Set all variables for **Production**, **Preview**, and **Development**
3. **No Spaces**: Don't add extra spaces around the equals sign

### 4. Deploy
After adding all environment variables, trigger a new deployment by:
1. Going to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Select **Redeploy**

### 5. Test FCM
Once deployed, test the push notification system:
1. Go to your app as an admin
2. Use the notification test component in the dashboard
3. Try sending both local and FCM push notifications

## Troubleshooting

If push notifications still don't work:
1. Check Vercel function logs for any errors
2. Verify all environment variables are set correctly
3. Make sure Firebase project has the correct permissions
4. Test locally first with the same environment variables

---

Your FCM implementation is now ready! 🚀