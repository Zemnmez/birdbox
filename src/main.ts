const puppeteer = require('puppeteer');
const { promisify } = require('util');
const read = promisify(require('read'));
const { Spinner } = require('cli-spinner');
const { chromeCanary: chromeCanaryPath } = require('chrome-paths');
const fs = require('fs');

const hurl = (error) => { throw new Error(error) }
const nop = () => undefined;

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
const isAsyncFunction = (fn) => fn.constructor == AsyncFunction;

class BirdBox {
	constructor() {

	}

	displayLoading(fn, name, {clear = true} = {}) {
		return async (...args) => {
			const s = new Spinner({
				text: `%s ${name}(${args.join(", ")})`.replace(/\n/g, "\\n")
			});

			s.setSpinnerString(20);

			s.start();

			const out = await fn(...args);

			s.stop(clear);

			return out;
		}
	}

	enhanceAsyncToDisplayLoading(obj) {
		return new Proxy(obj, {
			get: (...args) => {
				const [target, prop] = args;
				const v = Reflect.get(...args);
				if (typeof v == "function") return this.displayLoading(
					v.bind(target),
					String(prop),
				);

				return v;
			}
		})
	}

	async toggleMic(page) {
		const micButton = ".player-button.talkback"
		await page.show.waitForSelector(micButton, { visible: true });
		await page.show.click(micButton);
	}

	async fill2fa(page) {
		const mfaFields = ".mfa-fields input";
		await page.show.waitForSelector(mfaFields)
		await page.show.click(mfaFields)

		await page.show.type(mfaFields, await read({ prompt: "2fa code" }) +"\n", {delay: 100});

		const signinButton = ".mfa-passcode-view-buttons";
		await page.show.waitForSelector(signinButton);
		await page.show.click(signinButton, '#verify-pin-button');
	}


	async logIn(page) {
		console.log("it looks like you're logged out!");
		const emailInput = ".email-input input";
		await page.show.waitForSelector(emailInput, { visible: true });
		await page.show.click(emailInput);
		await page.show.type(emailInput, await read({ prompt: "email:" }));


		const passInput = ".pass-input input";
		await page.show.waitForSelector(passInput, { visible: true});
		await page.show.click(passInput);
		await page.show.type(passInput, await read({
			prompt: "password:",
			silent: true,
			replace: "・"
		}));

		const signinButton = ".signin-button-container input";
		await page.show.click(signinButton);

		try {
			await page.show.waitForSelector(".mfa-fields", { visible: true});
			await this.fill2fa(page);
		} catch (e) { console.log(e) }
	}

	handleErrors(page) {
		page.waitForSelector(".error-msg", { timeout: 0, visible: true }).then(
			(elem: Element) => {  throw new Error(elem.textContent) });
	}

	async _getState(page, { timeout = 10000 } = {}) {
		return await Promise.race([
			page.waitForSelector(".pass-input", { visible: true }).then(v => "login"),
			page.waitForSelector('a[href^="/camera"]', { visible: true }).then(v => "home"),
			new Promise((resolve, reject) => setTimeout(() => resolve("UNKNOWN"), timeout))
		]).catch((e) => console.log(e));

	}

	async getState(page, options?) {
		return await this.displayLoading(this._getState, "getState")(page, options || {})
	}

	async mustGetState(p, options?) {
		const page = await this.getState(p, options);
		if (page == "UNKNOWN") throw "we find ourselves in an unknown state";

		return page;
	}

	async main(page) {
		await page.show.goto('https://home.nest.com');
		this.handleErrors(page);

		if (await this.mustGetState(page, {}) == "login") await this.logIn(page);
		if (await this.mustGetState(page, {}) != "home") throw "expected to be home by now...";

		const cameraLink = 'a[href^="/camera"]';
		await page.show.waitForSelector(cameraLink);
		await page.show.click(cameraLink);

		await this.toggleMic(page);
	}

	async run() {
		// is chrome canary installled and can we access it?
		await new Promise(
			(ok, fail) => fs.access(
				chromeCanaryPath,
				fs.X_OK,
				(err) => err?fail(`please install chrome canary to ${chromeCanaryPath}`):ok() )
			);

		const browser = await puppeteer.launch({
			headless: process.env.NODE_ENV == 'production',
			userDataDir: "./browser_data",
			executablePath: chromeCanaryPath,
			dumpio: true,
			args: [
				// prevents showing user confirmation we cant click
				// to use the mic
				"--use-fake-ui-for-media-stream",

				"--use-fake-device-for-media-stream",

				// plays a test sound instead of using a real mic
				"--use-file-for-fake-audio-capture=dist/wii-shop-music.wav"
			]
		});


		try {
			const page = await browser.newPage();
			page.show = this.enhanceAsyncToDisplayLoading(page);


			await this.main(page)

			console.log("completed all tasks. dropping to selector REPL.")
			for (;;) {
				console.log(await page.$(await read({ prompt: "query" })))
			}
		} catch(e) {
			const ssloc = "screenshot.png";
			console.log(e);
			console.log("a fatal error has occurred.");
			await browser.screenshot({ path: ssloc });
			console.log(`a screenshot of the browser at crash time has been saved as ${ssloc}`);
		} finally { await browser.close() }

	}
}


new BirdBox().run();
