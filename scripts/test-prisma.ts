import prisma from '../src/lib/prisma';

async function testPrisma() {
  try {
    console.log('Testing Prisma connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Prisma connected successfully!');
    
    // Test a simple query - replace 'yourModelName' with your actual Prisma model name
    // For example: if your model is called 'Shop', use prisma.shop.count()
    const modelName = Object.keys(prisma).find(
      key => typeof prisma[key]?.count === 'function' && key !== '$transaction' && key !== '$on'
    );
    
    if (modelName) {
      const count = await prisma[modelName].count();
      console.log(`ℹ️ Found ${count} records in ${modelName} model`);
      
      // Get the first record as an example
      const firstRecord = await prisma[modelName].findFirst();
      if (firstRecord) {
        console.log(`First ${modelName} record:`, JSON.stringify(firstRecord, null, 2));
      }
    } else {
      console.log('No models found with a count method');
      
      // List all available models
      const models = Object.keys(prisma).filter(
        key => typeof prisma[key] === 'object' && prisma[key] !== null
      );
      console.log('Available models:', models);
    }
    
  } catch (error) {
    console.error('❌ Prisma error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();
