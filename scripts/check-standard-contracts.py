"""Planning contracts only, not application/device tests. See requirements-plan.txt."""
import json
from pathlib import Path
from openapi_spec_validator import validate
from jsonschema import Draft202012Validator, FormatChecker
root = Path(__file__).resolve().parents[1]
read = lambda name: json.loads((root / 'specs' / name).read_text())
api = read('openapi.json')
validate(api)
config_schema = read('campaign.schema.json')
Draft202012Validator.check_schema(config_schema)
Draft202012Validator(config_schema, format_checker=FormatChecker()).validate(read('campaign.example.json'))
examples = read('api-examples.json')['examples']
for item in examples:
    document = {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$ref': '#/components/schemas/' + item['schema'], 'components': api['components']}
    Draft202012Validator(document, format_checker=FormatChecker()).validate(item['value'])
print(json.dumps({'result':'PASS','scope':'OpenAPI 3.1 and JSON Schema 2020-12 standards; no app/device tests','examples':len(examples)}, ensure_ascii=False))
