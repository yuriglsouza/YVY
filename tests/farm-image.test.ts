import assert from "node:assert/strict";
import test from "node:test";
import {
  detectFarmImageContentType,
  MAX_FARM_IMAGE_BYTES,
  validateFarmImageMetadata,
} from "../shared/farm-image.js";

test("accepts supported farm image metadata and rejects unsafe uploads", () => {
  assert.equal(validateFarmImageMetadata({ contentType: "image/jpeg", size: 1024 }), null);
  assert.match(validateFarmImageMetadata({ contentType: "image/svg+xml", size: 1024 }) || "", /JPG, PNG ou WebP/);
  assert.match(validateFarmImageMetadata({ contentType: "image/png", size: MAX_FARM_IMAGE_BYTES + 1 }) || "", /6 MB/);
});

test("detects supported image signatures from uploaded bytes", () => {
  assert.equal(detectFarmImageContentType(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectFarmImageContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectFarmImageContentType(new TextEncoder().encode("RIFF0000WEBP")), "image/webp");
  assert.equal(detectFarmImageContentType(new TextEncoder().encode("not-an-image")), null);
});
