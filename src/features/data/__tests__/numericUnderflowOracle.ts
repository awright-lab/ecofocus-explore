// Independently generated with Python Decimal/Fraction and binary64 conversion.
export const numericUnderflowOracle={
  "vectors": [
    {
      "raw": "1e-9999",
      "expected": null,
      "exactZero": false,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "-1e-9999",
      "expected": null,
      "exactZero": false,
      "binary64Hex": "8000000000000000"
    },
    {
      "raw": "2e-324",
      "expected": null,
      "exactZero": false,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "-2e-324",
      "expected": null,
      "exactZero": false,
      "binary64Hex": "8000000000000000"
    },
    {
      "raw": "0.00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
      "expected": null,
      "exactZero": false,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "-$1e-9999",
      "expected": null,
      "exactZero": false,
      "binary64Hex": "8000000000000000"
    },
    {
      "raw": "1e-9999%",
      "expected": null,
      "exactZero": false,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "0",
      "expected": 0.0,
      "exactZero": true,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "-0.00",
      "expected": -0.0,
      "exactZero": true,
      "binary64Hex": "8000000000000000"
    },
    {
      "raw": "0e99999",
      "expected": 0.0,
      "exactZero": true,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "+0.0e-99999",
      "expected": 0.0,
      "exactZero": true,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "$0.00",
      "expected": 0.0,
      "exactZero": true,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "0%",
      "expected": 0.0,
      "exactZero": true,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "0,000.000",
      "expected": 0.0,
      "exactZero": true,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "5e-324",
      "expected": 5e-324,
      "exactZero": false,
      "binary64Hex": "0000000000000001"
    },
    {
      "raw": "-5e-324",
      "expected": -5e-324,
      "exactZero": false,
      "binary64Hex": "8000000000000001"
    },
    {
      "raw": "1e-323",
      "expected": 1e-323,
      "exactZero": false,
      "binary64Hex": "0000000000000002"
    },
    {
      "raw": "1e-308",
      "expected": 1e-308,
      "exactZero": false,
      "binary64Hex": "000730d67819e8d2"
    },
    {
      "raw": "1.7976931348623157e308",
      "expected": 1.7976931348623157e+308,
      "exactZero": false,
      "binary64Hex": "7fefffffffffffff"
    },
    {
      "raw": "1e9999",
      "expected": null,
      "exactZero": false,
      "binary64Hex": null
    },
    {
      "raw": "-1e9999",
      "expected": null,
      "exactZero": false,
      "binary64Hex": null
    },
    {
      "raw": "2.4703282292062327e-324",
      "expected": null,
      "exactZero": false,
      "binary64Hex": "0000000000000000"
    },
    {
      "raw": "2.4703282292062328e-324",
      "expected": 5e-324,
      "exactZero": false,
      "binary64Hex": "0000000000000001"
    }
  ],
  "half_minimum": {
    "exactNonzero": true,
    "binary64Result": 0.0,
    "exactNumerator": "1",
    "exactDenominator": "404804506614621236704990693437834614099113299528284236713802716054860679135990693783920767402874248990374155728633623822779617474771586953734026799881477019843034848553132722728933815484186432682479535356945490137124014966849385397236206711298319112681620113024717539104666829230461005064372655017292012526615415482186989568"
  },
  "scope": "Exact Decimal source-zero classification and Python binary64 conversion; Fraction verifies nonzero half-minimum. Not arbitrary-precision production analysis."
} as const;
