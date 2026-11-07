// Python Fraction reference over exact binary64 inputs; guard policy stated separately.
export const profileOverflowOracle={
  "cases": [
    {
      "label": "reported cancellation",
      "values": [
        "-1e308",
        "-1e308",
        "1",
        "1e308",
        "1e308"
      ],
      "exactTotalNumerator": "1",
      "exactTotalDenominator": "1",
      "exactMeanNumerator": "1",
      "exactMeanDenominator": "5",
      "referenceMean": 0.2,
      "referenceMeanBits": "3fc999999999999a",
      "expectedGuardedMean": null
    },
    {
      "label": "opposite order residual",
      "values": [
        "1e308",
        "1e308",
        "-1e308",
        "-1e308",
        "1"
      ],
      "exactTotalNumerator": "1",
      "exactTotalDenominator": "1",
      "exactMeanNumerator": "1",
      "exactMeanDenominator": "5",
      "referenceMean": 0.2,
      "referenceMeanBits": "3fc999999999999a",
      "expectedGuardedMean": null
    },
    {
      "label": "constant positive",
      "values": [
        "1e308",
        "1e308"
      ],
      "exactTotalNumerator": "200000000000000002195812725888091083480984619354623692673621365806315170809822983074326657956989377798122499339442345031223180567486280176656614018396292092062543329005866054371394979399177118086676768932330002356853795252425890355256182391573414916245567940343568830210583605786415746545949771430860446236672",
      "exactTotalDenominator": "1",
      "exactMeanNumerator": "100000000000000001097906362944045541740492309677311846336810682903157585404911491537163328978494688899061249669721172515611590283743140088328307009198146046031271664502933027185697489699588559043338384466165001178426897626212945177628091195786707458122783970171784415105291802893207873272974885715430223118336",
      "exactMeanDenominator": "1",
      "referenceMean": 1e+308,
      "referenceMeanBits": "7fe1ccf385ebc8a0",
      "expectedGuardedMean": 1e+308
    },
    {
      "label": "constant negative",
      "values": [
        "-1e308",
        "-1e308"
      ],
      "exactTotalNumerator": "-200000000000000002195812725888091083480984619354623692673621365806315170809822983074326657956989377798122499339442345031223180567486280176656614018396292092062543329005866054371394979399177118086676768932330002356853795252425890355256182391573414916245567940343568830210583605786415746545949771430860446236672",
      "exactTotalDenominator": "1",
      "exactMeanNumerator": "-100000000000000001097906362944045541740492309677311846336810682903157585404911491537163328978494688899061249669721172515611590283743140088328307009198146046031271664502933027185697489699588559043338384466165001178426897626212945177628091195786707458122783970171784415105291802893207873272974885715430223118336",
      "exactMeanDenominator": "1",
      "referenceMean": -1e+308,
      "referenceMeanBits": "ffe1ccf385ebc8a0",
      "expectedGuardedMean": -1e+308
    },
    {
      "label": "proved opposite pairs",
      "values": [
        "1e308",
        "1e308",
        "-1e308",
        "-1e308"
      ],
      "exactTotalNumerator": "0",
      "exactTotalDenominator": "1",
      "exactMeanNumerator": "0",
      "exactMeanDenominator": "1",
      "referenceMean": 0.0,
      "referenceMeanBits": "0000000000000000",
      "expectedGuardedMean": 0
    },
    {
      "label": "unproved zero cancellation",
      "values": [
        "1e308",
        "1e308",
        "-1e308",
        "-5e307",
        "-5e307"
      ],
      "exactTotalNumerator": "0",
      "exactTotalDenominator": "1",
      "exactMeanNumerator": "0",
      "exactMeanDenominator": "1",
      "referenceMean": 0.0,
      "referenceMeanBits": "0000000000000000",
      "expectedGuardedMean": null
    },
    {
      "label": "ordinary accurate cancellation",
      "values": [
        "1e16",
        "1",
        "-1e16"
      ],
      "exactTotalNumerator": "1",
      "exactTotalDenominator": "1",
      "exactMeanNumerator": "1",
      "exactMeanDenominator": "3",
      "referenceMean": 0.3333333333333333,
      "referenceMeanBits": "3fd5555555555555",
      "expectedGuardedMean": 0.3333333333333333
    },
    {
      "label": "subnormal constant",
      "values": [
        "5e-324",
        "5e-324"
      ],
      "exactTotalNumerator": "1",
      "exactTotalDenominator": "101201126653655309176247673359458653524778324882071059178450679013715169783997673445980191850718562247593538932158405955694904368692896738433506699970369254960758712138283180682233453871046608170619883839236372534281003741712346349309051677824579778170405028256179384776166707307615251266093163754323003131653853870546747392",
      "exactMeanNumerator": "1",
      "exactMeanDenominator": "202402253307310618352495346718917307049556649764142118356901358027430339567995346891960383701437124495187077864316811911389808737385793476867013399940738509921517424276566361364466907742093216341239767678472745068562007483424692698618103355649159556340810056512358769552333414615230502532186327508646006263307707741093494784",
      "referenceMean": 5e-324,
      "referenceMeanBits": "0000000000000001",
      "expectedGuardedMean": 5e-324
    },
    {
      "label": "underflowed nonzero mean",
      "values": [
        "5e-324",
        "0"
      ],
      "exactTotalNumerator": "1",
      "exactTotalDenominator": "202402253307310618352495346718917307049556649764142118356901358027430339567995346891960383701437124495187077864316811911389808737385793476867013399940738509921517424276566361364466907742093216341239767678472745068562007483424692698618103355649159556340810056512358769552333414615230502532186327508646006263307707741093494784",
      "exactMeanNumerator": "1",
      "exactMeanDenominator": "404804506614621236704990693437834614099113299528284236713802716054860679135990693783920767402874248990374155728633623822779617474771586953734026799881477019843034848553132722728933815484186432682479535356945490137124014966849385397236206711298319112681620113024717539104666829230461005064372655017292012526615415482186989568",
      "referenceMean": 0.0,
      "referenceMeanBits": "0000000000000000",
      "expectedGuardedMean": null
    }
  ],
  "scope": "Exact Fraction arithmetic over binary64 input values; guarded outputs explicitly encode supported-range policy, not arbitrary-precision production calculations."
} as const;
