import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class Modbus implements ICredentialType {
	name = 'modbus';

	displayName = 'MODBUS';

	documentationUrl = 'modbus';

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
