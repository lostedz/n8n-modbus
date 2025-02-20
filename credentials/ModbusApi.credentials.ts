import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ModbusApi implements ICredentialType {
	name = 'modbusApi';

	displayName = 'MODBUS API';

	documentationUrl = 'https://github.com/lostedz/n8n-nodes-modbus';

	properties: INodeProperties[] = [
		{
			displayName: 'Protocol',
			name: 'protocol',
			type: 'options',
			options: [
				{
					name: 'Modbus',
					value: 'tcp',
				},
			],
			default: 'modbus',
		},
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 502,
		},
	];
}
