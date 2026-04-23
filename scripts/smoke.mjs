import { chromium } from "playwright";

const url = process.env.DOMELAB_URL ?? "http://127.0.0.1:5175/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("text=Dome Lab", { timeout: 10000 });
await page.waitForSelector("canvas", { timeout: 10000 });
await browser.close();
console.log("Dome Lab smoke check passed");
