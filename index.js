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

const testForClassSignups = async (browser, eventId, classIds) => {
  const url = `https://gtc.clubautomation.com/calendar/event-info?id=${eventId}`
  const page = await browser.newPage();
  await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
      )
  await page.goto(url);
  await page.waitForSelector('tr');
  const rowsWithIds =  await page.evaluate(() => {
    const allRows = Array.from(document.querySelectorAll('tr'));
    const rowsWithIdAndStatus = allRows.map(row => {
      const classSpan = row.querySelectorAll('span.ticket-id');
      if (classSpan.length !== 1) {
        return null;
      }
      const classId = classSpan[0].innerHTML.trim();
      const ctaSpan = row.querySelectorAll('li.class-program-cta');
      if (ctaSpan.length !== 1) {
        return null;
      }
      const button = ctaSpan[0].querySelector('button');
      if (!button) {
        return null;
      }
      const buttonText = button.innerHTML.trim();
      return [classId, buttonText];
    }).filter(result => result); // remove nulls
    return rowsWithIdAndStatus;
  })
  console.log('rows', rowsWithIds);
  // const tableRows = await page.$x('//tr');
  // // const matchedRow = tableRows.filter(async row => {
  // //   const td = await tableRows[0].evaluate(r => console.log(r));
  // //   console.log(td);
  // //   return false;
  // // })
  // const row = tableRows[0];
  // console.log('row 1', row);
  // const result = await row.evaluate(r => typeof r);
  // console.log('res', JSON.stringify(result));

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

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: process.env.FROM_EMAIL, // sender address
    to: process.env.TO_EMAIL, // list of receivers
    subject: "Delta flights check", // Subject line
    text: `Test flights available? ${testFlight}
    Actual? ${actualFlight ? 'YES! GO GO!' : 'No'}`, // plain text body
  });

  console.log("Message sent!");
}

(async () => {
    
    // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-on-heroku
    const browser = await puppeteer.launch({ headless: true, slowMo: 100, args: ['--no-sandbox'] });

    // search for flight after 5pm
    const eventId = 28;
    const classIds = [449892];
    const actualTest = await testForClassSignups(browser, eventId, classIds);
    console.log('5pm actual result', actualTest);
    
    // // search for flight around noon (test)
    // const testFlight = await testForFlights(browser, process.env.TEST_URL);
    // console.log('noon TEST result', testFlight);

    // if (actualTest) {
    //     console.log('sending email and text message!')
    //     await sendNotifications(testFlight, actualTest);
    // }

    // if (process.env.TEST_RUN === 'true') {
    //     console.log('sending TEST email and text message!')
    //     await sendNotifications(testFlight, actualTest);
    // }

    await browser.close();
    
  })();
