# Calc — All-in-One Calculator (Android test APK)

This repository packages the HTML/CSS/JavaScript calculator as an Android app using Capacitor and builds a test APK with GitHub Actions.

## Build the APK on GitHub

1. Create a new repository on GitHub (for example, `calculator-app`). A public repository is simplest for a first test.
2. Upload all files and folders from this project, keeping the `.github/workflows/build-apk.yml` file and the `www` folder in place.
3. Commit the files to the `main` branch.
4. Open the repository's **Actions** tab.
5. Select **Build Calculator APK** and click **Run workflow** if the workflow has not already started after your push.
6. Wait for the workflow to finish with a green check.
7. Open the completed workflow run. Under **Artifacts**, download `calculator-debug-apk`.
8. Extract the downloaded artifact ZIP. It contains `app-debug.apk`.
9. Transfer `app-debug.apk` to your Android phone and install it. If Android asks, allow installation from that source. Only install APKs you built or trust.

## Update the calculator later

Edit `www/index.html`, `www/style.css`, or `www/script.js`, commit the changes, and GitHub Actions will build a new APK.

## Important

- This is a **debug APK for testing**, not a signed release for Google Play.
- The calculator is designed to work offline for calculations; Google Fonts may require internet to load the chosen typeface.
- The history is saved in local app storage on the device.
- If the build fails, open the failed workflow run and read the first red error step.
