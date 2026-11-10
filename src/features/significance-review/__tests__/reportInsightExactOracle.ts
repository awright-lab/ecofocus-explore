// Independent exact Python Fraction/Decimal reference.
export const reportInsightExactOracle={
  "scope": "Independent exact Fraction hypergeometric two-sided enumeration and complete-union Holm step-down; log conversion uses90-digit Decimal. All fabricated data; no scientific source authenticity claim.",
  "vectors": [
    {
      "label": "two questions",
      "alpha": 0.05,
      "families": [
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "A",
            "events": 17,
            "others": 3
          },
          {
            "code": "B",
            "events": 14,
            "others": 6
          }
        ],
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "C",
            "events": 19,
            "others": 1
          }
        ]
      ],
      "familySize": 3,
      "expected": [
        {
          "familyIndex": 0,
          "code": "A",
          "status": "tested",
          "table": [
            17,
            3,
            10,
            10
          ],
          "rawLogP": -3.20048608186697,
          "difference": 35.0,
          "adjustedLogP": -2.5073389013070244,
          "exactAdjustedNumerator": "18973",
          "exactAdjustedDenominator": "232841"
        },
        {
          "familyIndex": 0,
          "code": "B",
          "status": "tested",
          "table": [
            14,
            6,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": 20.0,
          "adjustedLogP": -1.0989731149642337,
          "exactAdjustedNumerator": "33251",
          "exactAdjustedDenominator": "99789"
        },
        {
          "familyIndex": 1,
          "code": "C",
          "status": "tested",
          "table": [
            19,
            1,
            10,
            10
          ],
          "rawLogP": -5.701170370428276,
          "difference": 45.0,
          "adjustedLogP": -4.602558081760166,
          "exactAdjustedNumerator": "23",
          "exactAdjustedDenominator": "2294"
        }
      ]
    },
    {
      "label": "uninterpreted family slots",
      "alpha": 0.05,
      "families": [
        [
          {
            "code": "Ref",
            "events": 0,
            "others": 20
          },
          {
            "code": "Event",
            "events": 20,
            "others": 0
          },
          {
            "code": "Invariant",
            "events": 0,
            "others": 20
          },
          {
            "code": "Empty",
            "events": 0,
            "others": 0,
            "missing": 2
          }
        ],
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "Other",
            "events": 15,
            "others": 5
          }
        ]
      ],
      "familySize": 4,
      "expected": [
        {
          "familyIndex": 0,
          "code": "Event",
          "status": "tested",
          "table": [
            20,
            0,
            0,
            20
          ],
          "rawLogP": -24.95625961269048,
          "difference": 100.0,
          "adjustedLogP": -23.56996525157059,
          "exactAdjustedNumerator": "2",
          "exactAdjustedDenominator": "34461632205"
        },
        {
          "familyIndex": 0,
          "code": "Invariant",
          "status": "no_variation",
          "table": [
            0,
            20,
            0,
            20
          ],
          "rawLogP": null,
          "difference": 0.0,
          "adjustedLogP": null,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 0,
          "code": "Empty",
          "status": "no_data",
          "table": [
            0,
            0,
            0,
            20
          ],
          "rawLogP": null,
          "difference": null,
          "adjustedLogP": null,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 1,
          "code": "Other",
          "status": "tested",
          "table": [
            15,
            5,
            10,
            10
          ],
          "rawLogP": -1.6565684498262778,
          "difference": 25.0,
          "adjustedLogP": -0.5579561611581683,
          "exactAdjustedNumerator": "19039",
          "exactAdjustedDenominator": "33263"
        }
      ]
    },
    {
      "label": "signed effects and unequal bases",
      "alpha": 0.05,
      "families": [
        [
          {
            "code": "Ref",
            "events": 45,
            "others": 55
          },
          {
            "code": "Lower",
            "events": 25,
            "others": 75
          },
          {
            "code": "SmallGap",
            "events": 80,
            "others": 120
          }
        ],
        [
          {
            "code": "Ref",
            "events": 60,
            "others": 40
          },
          {
            "code": "Higher",
            "events": 90,
            "others": 10
          }
        ]
      ],
      "familySize": 3,
      "expected": [
        {
          "familyIndex": 0,
          "code": "Lower",
          "status": "tested",
          "table": [
            25,
            75,
            45,
            55
          ],
          "rawLogP": -5.3646605921800985,
          "difference": -20.0,
          "adjustedLogP": -4.671513411620153,
          "exactAdjustedNumerator": "672745066813796061811996356492068",
          "exactAdjustedDenominator": "71889095367486530506530281987023489"
        },
        {
          "familyIndex": 0,
          "code": "SmallGap",
          "status": "tested",
          "table": [
            80,
            120,
            45,
            55
          ],
          "rawLogP": -0.7842049092924298,
          "difference": -5.0,
          "adjustedLogP": -0.7842049092924298,
          "exactAdjustedNumerator": "13276724560415769335896942181728271944201",
          "exactAdjustedDenominator": "29084848787746207116492250979122276995951"
        },
        {
          "familyIndex": 1,
          "code": "Higher",
          "status": "tested",
          "table": [
            90,
            10,
            60,
            40
          ],
          "rawLogP": -13.597708802762112,
          "difference": 30.0,
          "adjustedLogP": -12.499096514094003,
          "exactAdjustedNumerator": "13474103317561233723445614",
          "exactAdjustedDenominator": "3612339150229909410447897333547"
        }
      ]
    },
    {
      "label": "maximum selected family",
      "alpha": 0.05,
      "families": [
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "G0",
            "events": 2,
            "others": 18
          },
          {
            "code": "G1",
            "events": 6,
            "others": 14
          },
          {
            "code": "G2",
            "events": 14,
            "others": 6
          },
          {
            "code": "G3",
            "events": 18,
            "others": 2
          }
        ],
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "G0",
            "events": 2,
            "others": 18
          },
          {
            "code": "G1",
            "events": 6,
            "others": 14
          },
          {
            "code": "G2",
            "events": 14,
            "others": 6
          },
          {
            "code": "G3",
            "events": 18,
            "others": 2
          }
        ],
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "G0",
            "events": 2,
            "others": 18
          },
          {
            "code": "G1",
            "events": 6,
            "others": 14
          },
          {
            "code": "G2",
            "events": 14,
            "others": 6
          },
          {
            "code": "G3",
            "events": 18,
            "others": 2
          }
        ],
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "G0",
            "events": 2,
            "others": 18
          },
          {
            "code": "G1",
            "events": 6,
            "others": 14
          },
          {
            "code": "G2",
            "events": 14,
            "others": 6
          },
          {
            "code": "G3",
            "events": 18,
            "others": 2
          }
        ],
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "G0",
            "events": 2,
            "others": 18
          },
          {
            "code": "G1",
            "events": 6,
            "others": 14
          },
          {
            "code": "G2",
            "events": 14,
            "others": 6
          },
          {
            "code": "G3",
            "events": 18,
            "others": 2
          }
        ]
      ],
      "familySize": 20,
      "expected": [
        {
          "familyIndex": 0,
          "code": "G0",
          "status": "tested",
          "table": [
            2,
            18,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": -40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 0,
          "code": "G1",
          "status": "tested",
          "table": [
            6,
            14,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": -20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 0,
          "code": "G2",
          "status": "tested",
          "table": [
            14,
            6,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": 20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 0,
          "code": "G3",
          "status": "tested",
          "table": [
            18,
            2,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": 40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 1,
          "code": "G0",
          "status": "tested",
          "table": [
            2,
            18,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": -40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 1,
          "code": "G1",
          "status": "tested",
          "table": [
            6,
            14,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": -20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 1,
          "code": "G2",
          "status": "tested",
          "table": [
            14,
            6,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": 20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 1,
          "code": "G3",
          "status": "tested",
          "table": [
            18,
            2,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": 40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 2,
          "code": "G0",
          "status": "tested",
          "table": [
            2,
            18,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": -40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 2,
          "code": "G1",
          "status": "tested",
          "table": [
            6,
            14,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": -20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 2,
          "code": "G2",
          "status": "tested",
          "table": [
            14,
            6,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": 20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 2,
          "code": "G3",
          "status": "tested",
          "table": [
            18,
            2,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": 40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 3,
          "code": "G0",
          "status": "tested",
          "table": [
            2,
            18,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": -40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 3,
          "code": "G1",
          "status": "tested",
          "table": [
            6,
            14,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": -20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 3,
          "code": "G2",
          "status": "tested",
          "table": [
            14,
            6,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": 20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 3,
          "code": "G3",
          "status": "tested",
          "table": [
            18,
            2,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": 40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 4,
          "code": "G0",
          "status": "tested",
          "table": [
            2,
            18,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": -40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        },
        {
          "familyIndex": 4,
          "code": "G1",
          "status": "tested",
          "table": [
            6,
            14,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": -20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 4,
          "code": "G2",
          "status": "tested",
          "table": [
            14,
            6,
            10,
            10
          ],
          "rawLogP": -1.0989731149642337,
          "difference": 20.0,
          "adjustedLogP": 0.0,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "1"
        },
        {
          "familyIndex": 4,
          "code": "G3",
          "status": "tested",
          "table": [
            18,
            2,
            10,
            10
          ],
          "rawLogP": -4.282062005320103,
          "difference": 40.0,
          "adjustedLogP": -1.286329731766112,
          "exactAdjustedNumerator": "9190",
          "exactAdjustedDenominator": "33263"
        }
      ]
    },
    {
      "label": "raw code identities",
      "alpha": 0.05,
      "families": [
        [
          {
            "code": "constructor",
            "events": 3,
            "others": 7
          },
          {
            "code": "__proto__",
            "events": 7,
            "others": 3
          }
        ],
        [
          {
            "code": "Ref",
            "events": 10,
            "others": 10
          },
          {
            "code": "toString",
            "events": 13,
            "others": 7
          }
        ]
      ],
      "familySize": 2,
      "expected": [
        {
          "familyIndex": 0,
          "code": "__proto__",
          "status": "tested",
          "table": [
            7,
            3,
            3,
            7
          ],
          "rawLogP": -1.7209539567813794,
          "difference": 40.0,
          "adjustedLogP": -1.0278067762214342,
          "exactAdjustedNumerator": "16526",
          "exactAdjustedDenominator": "46189"
        },
        {
          "familyIndex": 1,
          "code": "toString",
          "status": "tested",
          "table": [
            13,
            7,
            10,
            10
          ],
          "rawLogP": -0.6479690762375719,
          "difference": 15.0,
          "adjustedLogP": -0.6479690762375719,
          "exactAdjustedNumerator": "156601",
          "exactAdjustedDenominator": "299367"
        }
      ]
    },
    {
      "label": "exact alpha boundary",
      "alpha": 0.1,
      "families": [
        [
          {
            "code": "Ref",
            "events": 3,
            "others": 0
          },
          {
            "code": "Boundary",
            "events": 0,
            "others": 3
          }
        ],
        [
          {
            "code": "Ref",
            "events": 0,
            "others": 20
          },
          {
            "code": "Strong",
            "events": 20,
            "others": 0
          }
        ]
      ],
      "familySize": 2,
      "expected": [
        {
          "familyIndex": 0,
          "code": "Boundary",
          "status": "tested",
          "table": [
            0,
            3,
            3,
            0
          ],
          "rawLogP": -2.302585092994046,
          "difference": -100.0,
          "adjustedLogP": -2.302585092994046,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "10"
        },
        {
          "familyIndex": 1,
          "code": "Strong",
          "status": "tested",
          "table": [
            20,
            0,
            0,
            20
          ],
          "rawLogP": -24.95625961269048,
          "difference": 100.0,
          "adjustedLogP": -24.263112432130534,
          "exactAdjustedNumerator": "1",
          "exactAdjustedDenominator": "34461632205"
        }
      ]
    }
  ]
} as const;
