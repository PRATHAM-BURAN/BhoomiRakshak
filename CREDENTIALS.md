# BhoomiRakshak (SIH26001) — System Access Credentials

This document provides official login credentials for the BhoomiRakshak AI Landslide Intelligence and Disaster Sentinel platform.

---

## 1. Central Master Administrator

| Attribute | Credential Detail |
| :--- | :--- |
| **Role** | `admin` |
| **Official Name** | `Admin` |
| **Login Identifier (Email)** | `admin@bhoomirakshak.gov.in` |
| **Password** | `AdminPassword2026!` |
| **QA Test Mobile (SMS OTP)** | `9021158105` (Instant OTP verification routes to Admin role) |
| **Mobile Contact** | `+91 9876543210` |
| **Clearance Level** | Full Institutional Clearance (Admin Command Deck, Live GIS Risk Maps, Emergency Warning Broadcasts, Officer Management, Retraining Pipeline) |

---

## 1.1 SMS OTP Quick-Testing Access (QA Mode)

For SMS OTP verification testing on real devices (powered by MSG91 SMS gateway):
- **Admin Phone Number:** `9021158105` (routes to `admin`)
- **Field Officer Phone Number:** `9067372943` (routes to `field_officer`)
- **How to test OTP:** Select "Mobile SMS OTP" in the Login dialog, enter phone number, request OTP, and enter the 6-digit OTP received on the phone.

---

## 2. The 8 Northeast India (NER) Field Masters / Sector Commanders

Each Field Master is responsible for ground-truth slope telemetry, ground observation validation, and emergency evacuation dispatch in their assigned state corridor. All Field Master passwords are set to their 10-digit mobile number.

| Sector # | State | Monitored Corridor / District | Officer Name | Mobile Number | Login Identifier (Email) | Password | Assigned Region ID |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Assam** | Dima Hasao (Haflong–Badarpur NH-27) | `Kailas Sadashiv Mutkule` | `+91 9699721767` | `kailasmutkule99@gmail.com` | `9699721767` | `ad2a2d14-f0c0-42eb-ac4a-23a7a42abcf5` |
| **2** | **Arunachal Pradesh** | Papum Pare (Itanagar NH-415) | `Adhishree Gajanan Sukalkar` | `+91 8010986532` | `adishreesukalkar53@gmail.com` | `8010986532` | `b0000002-0000-0000-0000-000000000002` |
| **3** | **Sikkim** | North Sikkim (Mangan Teesta Valley NH-10) | `Harsh Umesh Hatti` | `+91 9518597050` | `harshhatti291@gmail.com` | `9518597050` | `b0000003-0000-0000-0000-000000000003` |
| **4** | **Meghalaya** | East Khasi Hills (Shillong–Cherrapunji NH-6) | `Manav Ratan Agrawal` | `+91 8625816246` | `agrawalmanav83@gmail.com` | `8625816246` | `b0000004-0000-0000-0000-000000000004` |
| **5** | **Mizoram** | Aizawl (Durtlang Ridge NH-54) | `Ritika Suresh Gogawale` | `+91 9623895456` | `ritikagogawale14@gmail.com` | `9623895456` | `b0000005-0000-0000-0000-000000000005` |
| **6** | **Nagaland** | Kohima (Dimapur–Kohima NH-29) | `pratham prasad buran` | `+91 9067372943` | `comp24_pratham.buran@isbmcoe.org` | `9067372943` | `b0000006-0000-0000-0000-000000000006` |
| **7** | **Manipur** | Senapati (Imphal Valley NH-2) | `Amar` | `+91 9922387625` | `comp24_amarnath.budhwat@isbmcoe.org` | `9922387625` | `b0000007-0000-0000-0000-000000000007` |
| **8** | **Tripura** | Dhalai (Ambassa–Manu NH-8) | `sanskar mule` | `+91 8446222041` | `comp24_sanskar.mule@isbmcoe.org` | `8446222041` | `b0000008-0000-0000-0000-000000000008` |

---

## 3. Registered Community Citizens / Observers

Registered citizens receive priority community landslide advisories and submit geo-tagged hazard observations. Passwords are set to their 10-digit mobile number.

| Name | Role | Email | Mobile Number | Password | Assigned District |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pb` | `citizen` | `pbstorefile@gmail.com` | `9021158105` | `9021158105` | Dima Hasao, Assam |
| `Pratham Buran` | `citizen` | `prathamburan72pb@gmail.com` | `9067372943` | `9067372943` | Kohima, Nagaland |
| `Kailas Mutkule` | `citizen` | `kailas@gmail.com` | `9699721767` | `9699721767` | Dima Hasao, Assam |
| `Haflong Resident Observer` | `citizen` | `citizen.haflong@bhoomirakshak.gov.in` | `+91 9876543212` | `9876543212` | Dima Hasao, Assam |

---

## 3. Citizen / Public Access

Citizens can register directly through the **Citizen Sign-Up** tab on the web portal (`http://localhost:3000`), or browse the public community early warning feed and regional GIS risk map as a public guest without logging in.

- **Role**: `citizen`
- **Default Dashboard**: Community Citizen Portal & GIS Risk Map
- **Access Restrictions**: Administrative Command Deck and Field Officer dispatch consoles are strictly restricted.

---

## 4. How to Sign In

1. Open the BhoomiRakshak Web App: **`http://localhost:3000`**
2. Click the **Login / Register** button in the top navigation bar.
3. Enter the email address and password from the table above.
4. Click **Sign In to BhoomiRakshak**.
