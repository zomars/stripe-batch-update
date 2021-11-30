import fetch, { RequestInfo, Response } from "node-fetch";
import { config } from "dotenv";

config();

const url = "https://api.stripe.com/v1/customers";
const Authorization = `Bearer ${process.env.STRIPE_KEY}`; //Set this value in .env file in the same directory as this file
const maxPages = 999999999; //The maximum number of pages of records to update
const pageSize = 1000;
// const timeout = ;
const filter = (c) => c.description !== null && c.description !== "null";
const body = "description="; //Update any fields you want here, this sets the decription to null
let pages = 0;
let numOfRecords = 0;
let delay = 0; //Used to stagger requests

const AbortController = globalThis.AbortController;

const controller = new AbortController();
const signal = controller.signal;
const timeout = setTimeout(() => {
  controller.abort();
}, 10000);

async function cleanAll(previousId?: string) {
  const result = await cleanPage(previousId);
  if (result === undefined || pages > maxPages) {
    return undefined;
  } else {
    cleanAll(result);
  }
}

async function cleanPage(previousId?: string) {
  pages++;
  console.log(`Fetching page ${pages}`);
  let fetchUrl = `${url}?limit=${pageSize}`;
  if (previousId !== undefined) fetchUrl += `&starting_after=${previousId}`;
  const response = await fetchRecords(fetchUrl);
  const json = (await response.json()) as { data: any[]; has_more: boolean };
  json.data
    .filter(filter)
    .forEach((r: { id: string }) =>
      setTimeout(() => cleanRecord(r.id), delay++ * 500)
    );
  if (json.has_more === true) {
    let lastId = json.data[json.data.length - 1].id;
    console.log(`Fetching next page starting after id ${lastId}`);
    return lastId;
  } else {
    console.log(`Cleaned ${numOfRecords} records`);
    return undefined;
  }
}

async function fetchRecords(url: RequestInfo) {
  return fetch(url, {
    headers: {
      Authorization,
    },
    signal,
  }).finally(() => {
    clearTimeout(timeout);
  });
}

async function cleanRecord(recordId?: string) {
  numOfRecords++;
  console.log(`Cleaning ${recordId}`);
  const updateUrl = `${url}/${recordId}`;
  const response = await updateRecord(updateUrl);

  if (response.status !== 200) logError(response);

  const json = await response.json();

  if (json !== undefined) {
    console.log(`Successfully cleaned ${recordId}`);
  } else {
    console.error(`Failed to clean ${recordId}`);
  }
}

async function updateRecord(url: RequestInfo) {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal,
  }).finally(() => {
    clearTimeout(timeout);
  });
}

function logError(response: Response) {
  response.body.on("data", (chunk: any) => {
    console.log(`Received response ${response.status}\n${chunk}`);
  });
}

cleanAll();
