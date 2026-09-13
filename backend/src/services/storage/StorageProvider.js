/**
 * Storage abstraction for live recordings.
 * LocalDisk is the current provider. R2/S3 can implement the same interface later
 * without rewriting upload/quota/access flows. Do not fake cloud credentials here.
 */
class StorageProvider {
  async putFromPath(_key, _localPath, _contentType) {
    throw new Error('StorageProvider.putFromPath not implemented');
  }

  async openReadStream(_key) {
    throw new Error('StorageProvider.openReadStream not implemented');
  }

  async delete(_key) {
    throw new Error('StorageProvider.delete not implemented');
  }

  async exists(_key) {
    throw new Error('StorageProvider.exists not implemented');
  }
}

module.exports = { StorageProvider };
