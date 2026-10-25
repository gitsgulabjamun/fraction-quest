// World definitions and first-principles concept cards
const WORLDS = [
  null,
  { ex:'5.1', name:'Slice Shore', topic:'What a fraction means', color:'coral' },
  { ex:'5.2', name:'Number Line Ridge', topic:'Fractions on the number line', color:'teal' },
  { ex:'5.3', name:'Proper Peak', topic:'Proper and improper fractions', color:'butter' },
  { ex:'5.4', name:'Mixed Meadow', topic:'Mixed fractions', color:'lilac' },
  { ex:'5.5', name:'Twin Lagoon', topic:'Equivalent fractions', color:'coral' },
  { ex:'5.6', name:'Simple Springs', topic:'Simplest form', color:'teal' },
  { ex:'5.7', name:'Compare Cliffs', topic:'Comparing and ordering', color:'butter' },
  { ex:'5.8', name:'Plus Minus Bay', topic:'Adding and subtracting', color:'lilac' },
  { ex:'5.9', name:'Times Tower', topic:'Multiplying fractions', color:'coral' },
  { ex:'5.10', name:'Flip Falls', topic:'Dividing fractions', color:'teal' },
  { ex:'5.11', name:'BODMAS Bridge', topic:'Simplifying expressions', color:'butter' },
  { ex:'Boss', name:'Crown Island', topic:'Revision and objective questions', color:'lilac' },
];

const LEARN = {
  1: { fig:{k:'pie',n:4,s:[0]}, big:'A fraction is a part of a whole that has been cut into EQUAL parts.', pts:[
      'The <b>denominator</b> (bottom) says how many equal parts the whole is cut into.',
      'The <b>numerator</b> (top) says how many of those parts you take.',
      'The whole can be one thing (a cake) or a group (20 stamps). {1/4} of 20 stamps means split 20 into 4 equal groups and take 1 group: 5 stamps.',
      'If the parts are not equal, it is not a fraction of the whole. Always check the sizes.' ],
    ask:'If {3/4} of a class is 18 children, how many children is {1/4}? How many in the whole class?' },
  2: { fig:{k:'nl',max:1,den:5,at:3}, big:'Every fraction is a point on the number line.', pts:[
      'To show {3/5}, cut the gap from 0 to 1 into 5 equal jumps. Then make 3 jumps from 0.',
      'The denominator decides the jump size. The numerator decides how many jumps.',
      'Improper fractions just keep jumping past 1. {7/5} is 7 jumps of {1/5}, which lands after 1.',
      'Between any two fractions there is always another one. Cut the jumps smaller and new points appear.' ],
    ask:'Is {2/4} at the same point as {1/2}? Draw both lines and check.' },
  3: { fig:{k:'row',items:[{k:'pie',n:4,s:[0,1,2]},{k:'pie',n:4,s:[0,1,2,3]},{k:'pie',n:4,s:[0]}]}, big:'Compare the top with the bottom to know if a fraction is less than, equal to, or more than 1.', pts:[
      '<b>Proper</b>: top smaller than bottom, like {3/4}. You have fewer pieces than one whole needs. Less than 1.',
      'Top equal to bottom, like {4/4}, is exactly 1 whole.',
      '<b>Improper</b>: top equal to or bigger than bottom, like {5/4}. You have enough pieces for a whole and more.',
      'You can decide this just by looking. No working needed.' ],
    ask:'Can a proper fraction ever be bigger than an improper one? Why not?' },
  4: { fig:{k:'row',items:[{k:'pie',n:3,s:[0,1,2]},{k:'pie',n:3,s:[0,1,2]},{k:'pie',n:3,s:[0]}]}, big:'A mixed fraction is wholes plus a leftover proper fraction.', pts:[
      '{7/3} means 7 pieces of {1/3}. Every 3 pieces make a whole, so 7 pieces is 2 wholes and 1 piece left: {2 1/3}.',
      'Improper to mixed: divide. Quotient is the wholes, remainder goes on top, denominator stays.',
      'Mixed to improper: wholes × denominator + numerator. {2 1/3} = (2 × 3 + 1)/3 = {7/3}.',
      'The fraction part of a mixed number must be proper. {2 4/3} is not finished: it is really {3 1/3}.' ],
    ask:'7 rotis are shared by 3 friends. Why is the answer a mixed number?' },
  5: { fig:{k:'row',items:[{k:'grid',r:1,c:2,s:[0]},{k:'grid',r:2,c:2,s:[0,2]},{k:'grid',r:2,c:4,s:[0,1,4,5]}]}, big:'Equivalent fractions are different names for the same amount.', pts:[
      '{1/2}, {2/4} and {4/8} cover the same area. Cutting each piece into smaller pieces does not change how much you have.',
      'Multiply OR divide the top and bottom by the same number. The value stays the same.',
      'Adding the same number to top and bottom does NOT work. {1/2} and {2/3} are different amounts.',
      'Check if two fractions are equal by cross multiplying: {2/3} and {8/12} give 2 × 12 = 24 and 8 × 3 = 24. Equal!' ],
    ask:'Why does multiplying top and bottom by 3 not change the value? Think of cutting every piece into 3.' },
  6: { fig:{k:'grid',r:3,c:4,s:[0,1,2,4,5,6,8,9,10]}, big:'Simplest form means the top and bottom share no common factor except 1.', pts:[
      'Divide the top and bottom by a common factor, and keep going until you cannot.',
      'Fastest: divide once by the HCF. {72/81}: HCF is 9, so {72/81} = {8/9}.',
      'Your final answer should ALWAYS be in simplest form. {3/3} is just 1, and {12/4} is just 3.',
      'Simplifying makes it easy to see if two fractions are equal: {4/16} and {5/20} are both {1/4}.' ],
    ask:'Is {21/35} in simplest form? Which number divides both?' },
  7: { fig:{k:'row',items:[{k:'grid',r:1,c:3,s:[0]},{k:'grid',r:1,c:5,s:[0]}]}, big:'To compare fractions, make the pieces the same size, or use cross multiplication.', pts:[
      'Same denominator: bigger numerator wins. {5/7} > {3/7}.',
      'Same numerator: SMALLER denominator wins, because the pieces are bigger. {1/3} > {1/5}.',
      'Different everything: change to a common denominator (LCM), or cross multiply. For {5/11} and {4/9}: 5 × 9 = 45, 4 × 11 = 44, so {5/11} is bigger.',
      'Quick check: compare with {1/2}. {7/15} is just under half, {9/16} is just over.' ],
    ask:'Which is bigger, {7/8} or {8/9}? Hint: how far is each one from 1?' },
  8: { fig:{k:'row',items:[{k:'pie',n:2,s:[0]},{k:'pie',n:4,s:[0]},{k:'pie',n:4,s:[0,1,2]}]}, big:'You can only add or subtract pieces of the same size.', pts:[
      'Same denominator: add or subtract the numerators. The denominator stays (the piece size does not change).',
      'Different denominators: first rewrite both with the LCM as the denominator, then add.',
      'NEVER add the denominators. {1/2} + {1/4} is not {2/6}. That would be smaller than {1/2}!',
      'Mixed numbers: change to improper fractions, or add wholes and fractions separately. "Subtract A from B" means B − A.' ],
    ask:'Riya says {1/3} + {1/3} = {2/6}. Draw it. What went wrong?' },
  9: { fig:{k:'grid',r:3,c:5,s:[0,1,2,3,5,6,7,8]}, big:'Multiplying by a fraction means taking that fraction OF something.', pts:[
      '{2/3} × {4/5} means {2/3} of {4/5}. The picture shows {4/5} cut into thirds, taking 2 of them: {8/15}.',
      'Rule: top × top, bottom × bottom. Cancel common factors first to keep numbers small.',
      'Mixed numbers: change to improper first. Do NOT multiply wholes and fractions separately.',
      'Multiplying by a proper fraction makes a number SMALLER. Half of 10 is 5.' ],
    ask:'Is {3/4} × 20 more or less than 20? Decide before you calculate.' },
  10: { fig:{k:'row',items:[{k:'pie',n:2,s:[0,1]}]}, big:'Dividing asks: how many of these fit into that?', pts:[
      '1 ÷ {1/2} = 2, because two halves fit into 1.',
      'The <b>reciprocal</b> of {a/b} is {b/a}. A fraction times its reciprocal is 1.',
      'To divide, keep the first fraction and multiply by the reciprocal of the second.',
      'Dividing by a proper fraction makes a number BIGGER. 6 ÷ {1/2} = 12, since 12 halves fit into 6.' ],
    ask:'How many {3/4} m pieces can you cut from 6 m of ribbon?' },
  11: { fig:null, big:'BODMAS tells you the order: Brackets, Of, Division and Multiplication, Addition and Subtraction.', pts:[
      'Brackets first, innermost first: ( ), then { }, then [ ].',
      '"Of" means multiply, but it is done before ordinary × and ÷.',
      'Then × and ÷ from left to right. Then + and − from left to right.',
      'Write each step on a new line. Most mistakes come from doing two steps at once.' ],
    ask:'In {1/2} + {1/2} × 4, what do you do first?' },
  12: { fig:null, big:'Crown Island mixes everything. Read each question slowly before choosing a method.', pts:[
      'Ask yourself: what is the whole? What is the part?',
      'Estimate first. Should the answer be more or less than 1? Bigger or smaller than the starting number?',
      'Always simplify the final answer.',
      'Check your answer in a different way if you can (draw it, or work backwards).' ],
    ask:'Pick any wrong answer from today and explain to someone why it was wrong.' },
};
