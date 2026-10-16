import { createScalarHeaderFixture } from '../logs/mlg-fixture-builder';

/** Feed actual bytes through the application's file input and source owners. */
export function loadIntegrityAcceptanceFile(corrupt) {
  document.querySelector('[data-epicscope-mode="logger"]').click();
  const header = createScalarHeaderFixture({ version: 2, type: 0, recordLength: 1 });
  const records = corrupt
    ? [[10, 100, 1, true], [11, 101, 2, false], [11, 101, 2, true], [12, 102, 3, false], [13, 103, 4, true]]
    : [[10, 100, 1, true], [11, 101, 2, true], [12, 102, 3, true]];
  const bytes = new Uint8Array(header.length + records.length * 6); bytes.set(header);
  records.forEach(([counter, timestamp, value, valid], i) => bytes.set([0, counter, timestamp >> 8, timestamp & 255, value, valid ? value : value + 1], header.length + i * 6));
  const name = corrupt ? 'acceptance-integrity.mlg' : 'acceptance-clean-replacement.mlg';
  const transfer = new DataTransfer(); transfer.items.add(new File([bytes], name, { lastModified: 456 }));
  const input = document.querySelector('input[accept^=".mlg"]');
  // Earlier controlled file-read failures install a configurable own property.
  // Remove that fixture override so this gate uses the native FileList setter.
  if (Object.hasOwn(input, 'files')) delete input.files;
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return name;
}
