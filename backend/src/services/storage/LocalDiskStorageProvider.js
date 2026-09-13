const fs = require('fs');
const path = require('path');
const { StorageProvider } = require('./StorageProvider');

function getUploadsRoot() {
  const env = process.env.UPLOADS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  return path.join(__dirname, '../../../uploads');
}

class LocalDiskStorageProvider extends StorageProvider {
  constructor({ rootDir } = {}) {
    super();
    this.rootDir = rootDir || path.join(getUploadsRoot(), 'live-recordings');
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  resolveKey(key) {
    const safe = path.basename(String(key || ''));
    if (!/^[a-f0-9-]{36}\.webm$/i.test(safe)) {
      const err = new Error('Invalid storage key');
      err.code = 'INVALID_STORAGE_KEY';
      throw err;
    }
    return path.join(this.rootDir, safe);
  }

  async putFromPath(key, localPath, _contentType) {
    const dest = this.resolveKey(key);
    const src = path.resolve(localPath);
    if (src !== dest) {
      fs.renameSync(src, dest);
    }
    return { key: path.basename(dest), path: dest };
  }

  async openReadStream(key) {
    const filePath = this.resolveKey(key);
    if (!fs.existsSync(filePath)) {
      const err = new Error('Object not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    return fs.createReadStream(filePath);
  }

  async delete(key) {
    try {
      const filePath = this.resolveKey(key);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }

  async exists(key) {
    try {
      return fs.existsSync(this.resolveKey(key));
    } catch {
      return false;
    }
  }

  ensureDir() {
    fs.mkdirSync(this.rootDir, { recursive: true });
    return this.rootDir;
  }
}

let singleton = null;
function getLiveRecordingStorage() {
  if (!singleton) singleton = new LocalDiskStorageProvider();
  return singleton;
}

module.exports = {
  LocalDiskStorageProvider,
  getLiveRecordingStorage,
  getUploadsRoot,
};
