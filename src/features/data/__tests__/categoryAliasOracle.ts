// Exact Python Decimal alias reference; see private generator/review packet.
export const categoryAliasOracle={
  "scope": "Exact Python Decimal comparison of source category spelling and proposed canonical label key, without context rounding or binary64 equality. Own-key precedence tested separately.",
  "vectors": [
    {
      "raw": "1",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": "01",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": "1.0",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": "+1",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": "1e0",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": "10e-1",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": "1000e-3",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": ".1e1",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": "000.0100e2",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": " \t01\n",
      "labelKey": "1",
      "exactDecimalEqual": true,
      "expected": "1"
    },
    {
      "raw": "1.0000000000000001",
      "labelKey": "1",
      "exactDecimalEqual": false,
      "expected": "1.0000000000000001"
    },
    {
      "raw": "0.99999999999999999",
      "labelKey": "1",
      "exactDecimalEqual": false,
      "expected": "0.99999999999999999"
    },
    {
      "raw": "-01",
      "labelKey": "-1",
      "exactDecimalEqual": true,
      "expected": "-1"
    },
    {
      "raw": "-1.00",
      "labelKey": "-1",
      "exactDecimalEqual": true,
      "expected": "-1"
    },
    {
      "raw": "-10e-1",
      "labelKey": "-1",
      "exactDecimalEqual": true,
      "expected": "-1"
    },
    {
      "raw": "-1.0000000000000001",
      "labelKey": "-1",
      "exactDecimalEqual": false,
      "expected": "-1.0000000000000001"
    },
    {
      "raw": "0",
      "labelKey": "0",
      "exactDecimalEqual": true,
      "expected": "0"
    },
    {
      "raw": "-0",
      "labelKey": "0",
      "exactDecimalEqual": true,
      "expected": "0"
    },
    {
      "raw": "+0",
      "labelKey": "0",
      "exactDecimalEqual": true,
      "expected": "0"
    },
    {
      "raw": "000.000",
      "labelKey": "0",
      "exactDecimalEqual": true,
      "expected": "0"
    },
    {
      "raw": "0e9999",
      "labelKey": "0",
      "exactDecimalEqual": true,
      "expected": "0"
    },
    {
      "raw": "-0e-9999",
      "labelKey": "0",
      "exactDecimalEqual": true,
      "expected": "0"
    },
    {
      "raw": "1e-9999",
      "labelKey": "0",
      "exactDecimalEqual": false,
      "expected": "1e-9999"
    },
    {
      "raw": "-1e-9999",
      "labelKey": "0",
      "exactDecimalEqual": false,
      "expected": "-1e-9999"
    },
    {
      "raw": "1e-324",
      "labelKey": "0",
      "exactDecimalEqual": false,
      "expected": "1e-324"
    },
    {
      "raw": "-1e-324",
      "labelKey": "0",
      "exactDecimalEqual": false,
      "expected": "-1e-324"
    },
    {
      "raw": ".1",
      "labelKey": "0.1",
      "exactDecimalEqual": true,
      "expected": "0.1"
    },
    {
      "raw": "0.10",
      "labelKey": "0.1",
      "exactDecimalEqual": true,
      "expected": "0.1"
    },
    {
      "raw": "1e-1",
      "labelKey": "0.1",
      "exactDecimalEqual": true,
      "expected": "0.1"
    },
    {
      "raw": "0.10000000000000001",
      "labelKey": "0.1",
      "exactDecimalEqual": false,
      "expected": "0.10000000000000001"
    },
    {
      "raw": "9007199254740992.0",
      "labelKey": "9007199254740992",
      "exactDecimalEqual": true,
      "expected": "9007199254740992"
    },
    {
      "raw": "90071992547409920e-1",
      "labelKey": "9007199254740992",
      "exactDecimalEqual": true,
      "expected": "9007199254740992"
    },
    {
      "raw": "9007199254740993",
      "labelKey": "9007199254740992",
      "exactDecimalEqual": false,
      "expected": "9007199254740993"
    },
    {
      "raw": "50e-325",
      "labelKey": "5e-324",
      "exactDecimalEqual": true,
      "expected": "5e-324"
    },
    {
      "raw": "4.9406564584124654e-324",
      "labelKey": "5e-324",
      "exactDecimalEqual": false,
      "expected": "4.9406564584124654e-324"
    },
    {
      "raw": "10e307",
      "labelKey": "1e+308",
      "exactDecimalEqual": true,
      "expected": "1e+308"
    },
    {
      "raw": "1.00000000000000001e308",
      "labelKey": "1e+308",
      "exactDecimalEqual": false,
      "expected": "1.00000000000000001e308"
    },
    {
      "raw": "0x10",
      "labelKey": "16",
      "exactDecimalEqual": false,
      "expected": "0x10"
    },
    {
      "raw": "0b10",
      "labelKey": "2",
      "exactDecimalEqual": false,
      "expected": "0b10"
    },
    {
      "raw": "0o10",
      "labelKey": "8",
      "exactDecimalEqual": false,
      "expected": "0o10"
    },
    {
      "raw": "1_0",
      "labelKey": "10",
      "exactDecimalEqual": false,
      "expected": "1_0"
    },
    {
      "raw": "$1",
      "labelKey": "1",
      "exactDecimalEqual": false,
      "expected": "$1"
    },
    {
      "raw": "1%",
      "labelKey": "1",
      "exactDecimalEqual": false,
      "expected": "1%"
    },
    {
      "raw": "1,000",
      "labelKey": "1000",
      "exactDecimalEqual": false,
      "expected": "1,000"
    }
  ]
} as const;
