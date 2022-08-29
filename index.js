require("dotenv").config();
const puppeteer = require('puppeteer');
const nodemailer = require("nodemailer");

const testForFlights = async (browser, url) => {
    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
        )
    await page.goto(url);
    await page.waitForSelector('h3');
    const allFlights = await page.$x('//h3[contains(., "All flights")]');
    if (allFlights.length > 0) {
        const allFlightText = await allFlights[0].evaluate(el => el.textContent);
        return allFlightText === "All flights";
    }
    return false;
}

const sendNotifications = async (testFlight, actualFlight) => {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({

    service: 'gmail',
    auth: {
      user: process.env.FROM_EMAIL, // junk user account
      pass: process.env.EMAIL_PASSWORD, // generated app password
    },
  });
  console.log('sending from email to emails', process.env.FROM_EMAIL, process.env.TO_EMAIL)

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: process.env.FROM_EMAIL, // sender address
    to: process.env.TO_EMAIL, // list of receivers
    subject: "Delta flights check", // Subject line
    text: `Test flights available? ${testFlight}
    Actual? ${actualFlight ? 'YES! GO GO!' : 'No'}`, // plain text body
  });

  console.log("Message sent: %s", info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
}

(async () => {
    
    // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-on-heroku
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

    // search for flight after 5pm
    const actualTest = await testForFlights(browser, process.env.ACTUAL_URL);
    console.log('5pm test result', actualTest);
    
    // search for flight around noon (test)
    const testFlight = await testForFlights(browser, process.env.TEST_URL);
    console.log('noon test result', testFlight);

    if (testFlight) {
        console.log('sending email and text message!')
        await sendNotifications(testFlight, actualTest);
    }

    await browser.close();
    
  })();
