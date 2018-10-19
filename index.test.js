const chai = require('chai');
const sinon = require('sinon');
const chaiArrays = require('chai-arrays');
const sinonChai = require('sinon-chai');
const AWS = require('aws-sdk');
const chance = require('chance').Chance();

const config = require('./index');
const utils = require('./utils');

const { expect } = chai;
chai.use(sinonChai);
chai.use(chaiArrays);

describe('get', () => {
    it('should get the secret keys from secrets manager', async () => {
        const secretStub = sinon
            .stub(AWS.SecretsManager.prototype, 'makeRequest')
            .withArgs('getSecretValue')
            .returns({ promise: () => Promise.resolve({ SecretString: chance.string() }) });
        await config.get({ secretKeys: ['secret1'] });
        expect(secretStub).to.have.been.calledWith('getSecretValue', {
            SecretId: 'test_secret1',
        });
        AWS.SecretsManager.prototype.makeRequest.restore();
    });

    it('should get the config keys from S3', async () => {
        const s3Spy = sinon
            .stub(AWS.S3.prototype, 'makeRequest')
            .withArgs('getObject')
            .returns({ promise: () => Promise.resolve({ Body: chance.string() }) });
        await config.get({ configKeys: ['config1'] });
        expect(s3Spy).to.have.been.calledWith('getObject', {
            Bucket: 'configs',
            Key: 'test/config1',
        });
        AWS.S3.prototype.makeRequest.restore();
    });

    it('should set environment variables if `setEnvironment === true`', async () => {
        sinon
            .stub(AWS.S3.prototype, 'makeRequest')
            .withArgs('getObject')
            .returns({ promise: () => Promise.resolve({ Body: chance.string() }) });
        sinon
            .stub(AWS.SecretsManager.prototype, 'makeRequest')
            .withArgs('getSecretValue')
            .returns({ promise: () => Promise.resolve({ SecretString: chance.string() }) });
        await config.get({
            configKeys: ['config1'],
            secretKeys: ['secret1'],
            setEnvironment: true,
        });
        AWS.S3.prototype.makeRequest.restore();
        AWS.SecretsManager.prototype.makeRequest.restore();
        expect(Object.keys(process.env)).to.be.containingAllOf(['CONFIG1', 'SECRET1']);
    });

    it('should return all keys and their values', async () => {
        sinon
            .stub(AWS.S3.prototype, 'makeRequest')
            .withArgs('getObject')
            .returns({ promise: () => Promise.resolve({ Body: chance.string() }) });
        sinon
            .stub(AWS.SecretsManager.prototype, 'makeRequest')
            .withArgs('getSecretValue')
            .returns({ promise: () => Promise.resolve({ SecretString: chance.string() }) });
        const values = await config.get({
            configKeys: ['config1'],
            secretKeys: ['secret1'],
            populateEnv: true,
        });
        AWS.S3.prototype.makeRequest.restore();
        AWS.SecretsManager.prototype.makeRequest.restore();
        expect(values.map(val => val.name)).to.containingAllOf(['config1', 'secret1']);
    });

    it('should get local values when `NODE_ENV === local`', async () => {
        sinon.stub(utils, 'currentEnv').returns('local');
        const values = await config.get({
            configKeys: ['config1'],
            secretKeys: ['secret1'],
            populateEnv: true,
        });

        utils.currentEnv.restore();
        expect(values).to.have.deep.members([
            { name: 'config1', value: undefined },
            { name: 'secret1', value: undefined },
        ]);
    });
});

describe('set', () => {
    it('should set the configKeys in s3', async () => {
        const requestStub = sinon
            .stub(AWS.S3.prototype, 'makeRequest')
            .withArgs('putObject')
            .returns({ promise: () => Promise.resolve({ Body: chance.string() }) });
        await config.set({
            configPairs: [{ name: 'config1', value: 'value1' }],
        });
        AWS.S3.prototype.makeRequest.restore();
        expect(requestStub).to.have.been.calledWith('putObject', {
            Bucket: 'configs',
            Key: `${process.env.NODE_ENV}/config1`,
            Body: 'value1',
            ACL: 'bucket-owner-full-control',
        });
    });
    it('should stringify any non-string values sent to s3', async () => {
        const requestStub = sinon
            .stub(AWS.S3.prototype, 'makeRequest')
            .withArgs('putObject')
            .returns({ promise: () => Promise.resolve({ Body: chance.string() }) });
        await config.set({
            configPairs: [{ name: 'config1', value: { moshe: 'yakov' } }],
        });
        AWS.S3.prototype.makeRequest.restore();
        expect(requestStub).to.have.been.calledWith('putObject', {
            Bucket: 'configs',
            Key: `${process.env.NODE_ENV}/config1`,
            Body: JSON.stringify({ moshe: 'yakov' }),
            ACL: 'bucket-owner-full-control',
        });
    });
    it('should set the secretKeys in secretManager', async () => {
        const secretStub = sinon
            .stub(AWS.SecretsManager.prototype, 'makeRequest')
            .withArgs('updateSecret')
            .returns({ promise: () => Promise.resolve({ SecretString: chance.string() }) });
        await config.set({
            secretPairs: [{ name: 'secret1', value: 'value1' }],
        });
        AWS.SecretsManager.prototype.makeRequest.restore();
        expect(secretStub).to.have.been.calledWith('updateSecret', {
            Name: 'secret1',
            SecretString: 'value1',
        });
    });
    it('should stringify any non-string values sent to secrets manager', async () => {
        const secretStub = sinon
            .stub(AWS.SecretsManager.prototype, 'makeRequest')
            .withArgs('updateSecret')
            .returns({ promise: () => Promise.resolve({ SecretString: chance.string() }) });
        await config.set({
            secretPairs: [{ name: 'secret1', value: { moshe: 'yakov' } }],
        });
        AWS.SecretsManager.prototype.makeRequest.restore();
        expect(secretStub).to.have.been.calledWith('updateSecret', {
            Name: 'secret1',
            SecretString: JSON.stringify({ moshe: 'yakov' }),
        });
    });
    it('should exit if `NODE_ENV === local`', async () => {
        sinon.stub(utils, 'currentEnv').returns('local');
        const result = await config.set({
            secretPairs: [{ name: 'secret1', value: { moshe: 'yakov' } }],
        });

        utils.currentEnv.restore();
        expect(result).to.be.undefined; // eslint-disable-line no-unused-expressions
    });
    it('should do nothing if no configPairs or secretPairs are provided', async () => {
        const result = await config.set({ configPairs: [], secretPairs: [] });

        expect(result).to.eql([]); // eslint-disable-line no-unused-expressions
    });
    it('should return falsy values if no values are present in the config pairs', async () => {
        const result = await config.set({ configPairs: [{ name: 'moshe' }] });

        expect(result).to.eql([undefined]); // eslint-disable-line no-unused-expressions
    });
    it('should return falsy values if no values are present in the secret pairs', async () => {
        const result = await config.set({ secretPairs: [{ name: 'moshe' }] });

        expect(result).to.eql([undefined]); // eslint-disable-line no-unused-expressions
    });
});
