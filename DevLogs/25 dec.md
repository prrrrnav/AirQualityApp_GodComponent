To help you store this for future reference, here is a comprehensive summary of the steps we took to fix the data fetching issue and prepare your app for testing.

1. Problem Identification
The Issue: You could log in as an admin but couldn't see any AQI report data in the Android Studio emulator.

The Cause: The AqiReportScreen.tsx logic required a deviceId from a Bluetooth connection to trigger the backend API call. Since emulators lack physical Bluetooth hardware, the deviceId remained empty, causing the app to skip the database fetch and look for non-existent local data instead.

2. Database Investigation (VPS/MongoDB)
We used your root access to the VPS to retrieve the necessary identifiers from the production database:

Database Credentials: Found in the .env file (airquality_user / Admin123).

Admin User ID: We used mongosh to find the _id for admin@gmail.com, which is 68ffbf9666f0fa7539d94928.

Target Device ID: We found the specific device owned by the admin in the devices collection: 6943fa46f429c94f71aa8df4.

3. Code Modifications (The "Emulator Bypass")
We modified the mobile app code to allow testing without a physical sensor:

API Service Fallback: In api.ts, we added a DEBUG_DEVICE_ID constant. If the app detects an empty deviceId (common in emulators), it now defaults to your specific database device ID (6943fa46f429c94f71aa8df4) to fetch history.

UI Logic Update: In App.tsx, we ensured the AqiReportScreen receives this hardcoded ID as a fallback prop so the "Apply Filter" button becomes functional even when disconnected.

4. Application Build & Deployment
To move from the development environment to a standalone testable app, we identified the build process:

Cleaning: Used ./gradlew clean to remove cached build artifacts.

Signing: Discussed generating a .keystore for release builds.

APK Generation: Used ./gradlew assembleRelease to create the final app-release.apk file.

Installation: The APK is located at android/app/build/outputs/apk/release/ and can be installed via drag-and-drop onto the emulator.

5. Future Reference: Key Identifiers
Admin Email: admin@gmail.com

Admin User ID: 68ffbf9666f0fa7539d94928

Device ID (for History): 6943fa46f429c94f71aa8df4

Device MAC (for Ingestion): TEST-B8H2UULD

By saving this summary, you can quickly re-apply these bypasses if you ever reset your environment or need to troubleshoot why data isn't appearing on a new emulator instance.