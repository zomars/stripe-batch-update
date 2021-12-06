import { config } from "dotenv";
import Stripe from "stripe";

config();

// Set the STRIPE_KEY in .env file in the same directory as this file
const stripe = new Stripe(process.env.STRIPE_KEY, {
  apiVersion: "2020-08-27",
});

const maxPages = 999999999; //The maximum number of pages of records to update
const pageSize = 100;
const timeout = 10000;
let pages = 0;
let numOfRecords = 0;
let delay = 0; //Used to stagger requests

const recordToList = stripe.invoices; // Change to stripe.SOMETHING you want to list
const recordToUpdate = recordToList; // Change to stripe.SOMETHING you want to update
type Record = Stripe.Invoice; // Change to match your record to update

async function updateAll(previousId?: string) {
  const result = await updatePage(previousId);
  if (result === undefined || pages > maxPages) {
    setTimeout(
      () => console.log(`Updated ${numOfRecords} records`),
      delay++ * 500
    );
    return undefined;
  } else {
    updateAll(result);
  }
}

const OLD_FREE_PLAN_PRODUCTION = "price_1K1bbSH8UDiwIftkUS5CAKkh";
const NEW_FREE_PLAN_PRODUCTION = "price_1K2fZNH8UDiwIftkmV47Mes3";

const now = new Date();
const utcMilllisecondsSinceEpoch =
  now.getTime() + now.getTimezoneOffset() * 60 * 1000;
const utcSecondsSinceEpoch = Math.round(utcMilllisecondsSinceEpoch / 1000);

async function updatePage(previousId?: string) {
  pages++;
  console.log(`Fetching page ${pages}`);

  const response = await recordToList.list(
    {
      limit: pageSize,
      starting_after: previousId || undefined,
      // You can add filters here
      collection_method: "send_invoice",
      // @ts-ignore
      past_due: true,
      due_date: { lt: utcSecondsSinceEpoch },
    },
    { timeout }
  );
  response.data
    // Add extra filters here
    .filter((c) =>
      c.lines.data.some((i) => i.plan.product === "prod_JVxwoOF5odFiZ8")
    )
    .forEach((r) => setTimeout(() => updateRecord(r), delay++ * 500));
  if (response.has_more === true) {
    let lastId = response.data[response.data.length - 1].id;
    console.log(`Fetching next page starting after id ${lastId}`);
    return lastId;
  } else {
    return undefined;
  }
}

async function updateRecord(record: Record) {
  const recordId = record.id;
  numOfRecords++;
  console.log(`Updating ${recordId}`);
  try {
    await recordToUpdate.voidInvoice(recordId, {
      timeout,
    });
    console.log(`Successfully updated ${record.id}`);
  } catch (error) {
    console.error(`Failed to update ${recordId}`);
    console.error(error.message);
  }
}

updateAll();
