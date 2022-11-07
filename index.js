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

const testForClassSignups = async (browser, url, classIds) => {
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
  const matchingRows = rowsWithIds.filter(([classId, status]) => classIds.includes(classId));
  console.log('checked classes', matchingRows);
  const openClasses = matchingRows.filter(([classId, status]) => status === 'Sign Up');
  console.log('open classes', openClasses);
  return openClasses.length > 0;
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

const sendTennisNotifications = async (recipientEmailList, tennisUrl) => {
  // create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({

    service: 'gmail',
    auth: {
      user: process.env.FROM_EMAIL, // junk user account
      pass: process.env.EMAIL_PASSWORD, // generated app password
    },
  });

  // send mail with defined transport object
  await transporter.sendMail({
    from: process.env.FROM_EMAIL, // sender address
    to: recipientEmailList, // list of receivers
    subject: "Tennis Bot Check", // Subject line
    text: `Found Tennis lesson openings! ${tennisUrl}`, // plain text body
  });

  console.log("Message sent!");
}

(async () => {
    
    // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-on-heroku
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

    // search for flight after 5pm
    const USERS = process.env.USERS.split(',');
    for (const USER of USERS) {
      console.log('starting checks for user', USER);

      const eventIds = process.env[`${USER}_EVENT_IDS`].split(',');
      const classIdslist = process.env[`${USER}_CLASS_IDS`].split(';').map(group => group.split(','));
      const recpipients = process.env[`${USER}_TO_EMAIL`];

      for (const [ix, eventId] of eventIds.entries()) {
        const classIds = classIdslist[ix];
        if (!classIds || classIds.length === 0) {
          return;
        }
        const url = `https://gtc.clubautomation.com/calendar/event-info?id=${eventId}`
        console.log('checking url', url);
        const foundMatch = await testForClassSignups(browser, url, classIds);
        console.log('found', foundMatch);
        if (foundMatch) {
          sendTennisNotifications(recpipients, url);
        }
      }
    }

    // only send test notifications on Tues/Fri, 0 = SUN, 2 = Tues, 6 = SAT
    if (process.env.TEST_RUN === 'true' && [2, 5].includes(new Date().getDay())) {
      console.log('SENDING TEST MESSAGE');
      sendTennisNotifications(process.env.TEST_RECIPIENTS, 'TEST RUN');
    }
      

    await browser.close();

    
  })();
