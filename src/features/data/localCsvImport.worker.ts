import { createLocalCsvImportController, type CsvImportRequest } from "./localCsvImportProtocol";

const controller = createLocalCsvImportController(message => self.postMessage(message));
self.onmessage = (event: MessageEvent<CsvImportRequest>) => controller(event.data);
