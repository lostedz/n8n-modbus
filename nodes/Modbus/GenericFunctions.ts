import modbus from 'modbus-stream';
import { ApplicationError, INode, NodeOperationError } from 'n8n-workflow';
import { ModbusDataType } from './types';

interface BaseModbusCredential {
	host: string;
	port: number;
	timeout: number;
}

export type ModbusCredential = BaseModbusCredential;

export const createClient = async (credentials: ModbusCredential): Promise<modbus.TCPStream> => {
	const { host, port, timeout = 5000 } = credentials;

	return new Promise((resolve, reject) => {
		modbus.tcp.connect(port, host, { debug: null, connectTimeout: timeout }, (err, client) => {
			if (err) {
				reject(new ApplicationError(err.message));
				return;
			}

			resolve(client);
		});
	});
};

export function registerCount(dataType: ModbusDataType): number {
	if (dataType.endsWith('32')) return 2;
	if (dataType.endsWith('64')) return 4;
	return 1;
}

export function extractModbusData(
	node: INode,
	data: Buffer[],
	dataType: ModbusDataType,
): Array<number | bigint> {
	const registersPerItem = registerCount(dataType);
	if (data.length % registersPerItem !== 0) {
		throw new NodeOperationError(node, 'MODBUS Error: data is not aligned');
	}
	const mergedData: Buffer[] = [];
	for (let i = 0; i < data.length; i += registersPerItem) {
		if (registersPerItem === 1) {
			mergedData.push(data[i]);
		} else {
			const buf = Buffer.alloc(registersPerItem * 2);
			for (let j = 0; j < registersPerItem; j++) {
				data[i + j].copy(buf, j * 2);
			}
			mergedData.push(buf);
		}
	}
	return mergedData.map((buffer) => {
		switch (dataType) {
			case 'int16':
				return buffer.readInt16BE();
			case 'uint16':
				return buffer.readUInt16BE();
			case 'int32':
				return buffer.readInt32BE();
			case 'uint32':
				return buffer.readUInt32BE();
			case 'int64':
				return buffer.readBigInt64BE();
			case 'uint64':
				return buffer.readBigUInt64BE();
		}
	});
}
